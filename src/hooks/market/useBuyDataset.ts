'use client';

/**
 * 데이터셋 구매 플로우 (Midnight) — useFinalizeTournament 와 동일한 구조(inFlight ref + phase state).
 *
 *   1) createOrder — BE 가 CREATED 주문을 멱등 재사용하거나 새로 만든다.
 *   2) 이미 결제/처리가 진행된 주문(PAID/FULFILLING/FULFILLED)이면 결제를 건너뛰고 그대로 반환한다
 *      (동일 토너먼트 재구매 시도 시 중복 송금 방지).
 *   3) payOperator — Lace makeTransfer 로 BE 오퍼레이터(payTo)에게 priceUnits 만큼 직접 송금.
 *   4) payOrder — BE 에 결제 txId 를 기록 → fulfill 큐에 enqueue(폴링은 useOrder 가 담당).
 *
 * 배럴 재수출 금지 — hooks/market/index.ts 에서 export 하지 않는다(화면이 이 파일에서 직접 import).
 */

import { useCallback, useRef, useState } from 'react';
import { api } from '~/lib/api';
import { useMidnight } from '~/components/providers/MidnightProvider';
import { payOperator } from '~/lib/midnight/payment';
import type { MarketOrder } from '~/lib/api/market';
import { rememberPendingPaymentTx } from './pendingPaymentTx';

export type BuyDatasetPhase = 'idle' | 'creating' | 'paying' | 'recording' | 'done' | 'error';

// 이미 이 단계 이상 진행된 주문은 재결제하지 않는다 — CREATED 만 결제 대상.
const ALREADY_PAID_OR_LATER: readonly MarketOrder['status'][] = ['PAID', 'FULFILLING', 'FULFILLED'];

const RECORD_ATTEMPTS = 3;
const RECORD_RETRY_DELAY_MS = 2_000;

// BE 에 결제 txId 기록. MIDNIGHT_MARKET_VERIFY_PAYMENT_TX=true 환경에서는 방금 submit 한 tx 가
// 아직 인덱서에 없어 400 이 날 수 있으므로 블록 간격만큼 기다렸다가 재시도한다.
async function recordPayment(chainId: number, orderId: string, txId: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RECORD_ATTEMPTS; attempt++) {
    try {
      await api.market.payOrder(chainId, orderId, txId);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < RECORD_ATTEMPTS) await new Promise((r) => setTimeout(r, RECORD_RETRY_DELAY_MS * attempt));
    }
  }
  throw lastError;
}

export const useBuyDataset = (
  chainId: number | undefined,
  onSuccess: (info: { orderId: string }) => void,
  onError: (params: { orderId: string | undefined; error: unknown }) => void,
) => {
  const { wallet } = useMidnight();
  const [phase, setPhase] = useState<BuyDatasetPhase>('idle');
  const [orderId, setOrderId] = useState<string | undefined>(undefined);
  const inFlight = useRef(false);

  const buyDataset = useCallback(async (tournamentId: number) => {
    if (!chainId) { onError({ orderId: undefined, error: new Error('Chain not connected') }); return; }
    if (!wallet) { onError({ orderId: undefined, error: new Error('Wallet not connected') }); return; }
    if (inFlight.current) return;
    inFlight.current = true;
    let currentOrderId: string | undefined;
    try {
      // 1) 주문 생성 (CREATED 는 BE 가 멱등 재사용)
      setPhase('creating');
      const order = await api.market.createOrder(chainId, tournamentId);
      currentOrderId = order.orderId;
      setOrderId(order.orderId);

      if (!ALREADY_PAID_OR_LATER.includes(order.status)) {
        // 2) 결제 — Lace 로 오퍼레이터에게 직접 송금 시도. 현재 Lace 확장의 dApp 전송 API 가
        // 깨져 있어(makeTransfer: sender undefined) 실패할 수 있는데, 그 경우에도 주문 상세로
        // 이동시킨다 — 상세 화면의 ManualPayCard(지갑 UI 직접 송금 + 확인)가 이어받는다.
        // payOperator 는 submit 전에 txId 를 뽑으므로 여기서 throw 되면 돈은 나가지 않았다.
        setPhase('paying');
        let txId: string | undefined;
        try {
          txId = await payOperator(wallet.api, order.payTo, order.tokenTypeRaw, BigInt(order.priceUnits));
        } catch (payError) {
          console.warn('[useBuyDataset] in-page payment unavailable — falling back to manual pay:', payError);
        }

        if (txId) {
          // 3) BE 에 결제 기록 → fulfill 큐 enqueue. 여기서부터는 송금이 이미 나갔으므로 조용히
          // 수동 결제로 떨어뜨리면 안 된다(이중 송금 유도). 몇 번 재시도하고, 그래도 실패하면
          // txId 를 보존해 ManualPayCard 가 프리필하도록 하고, 에러를 알린 뒤 주문 상세로 넘긴다.
          setPhase('recording');
          try {
            await recordPayment(chainId, order.orderId, txId);
          } catch (recordError) {
            rememberPendingPaymentTx(order.orderId, txId);
            console.error('[useBuyDataset] payment submitted but recording failed — txId preserved:', txId, recordError);
            onError({
              orderId: order.orderId,
              error: new Error(`Payment sent (tx ${txId.slice(0, 12)}…) but recording failed: ${(recordError as Error)?.message ?? String(recordError)}`),
            });
          }
        }
      }

      setPhase('done');
      onSuccess({ orderId: order.orderId });
    } catch (error) {
      setPhase('error');
      onError({ orderId: currentOrderId, error });
      throw error;
    } finally {
      inFlight.current = false;
    }
  }, [chainId, wallet, onSuccess, onError]);

  return { buyDataset, phase, orderId };
};
