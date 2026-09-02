'use client';

/**
 * finalize 플로우 (Midnight):
 *   1) userSecret(로컬) → userPk. BE 에 grant 요청 → BE 가 eligibility leaf 를 온체인에 삽입하고
 *      `{ point, deadline }` 를 돌려준다 (기존 EVM 서명 발급 흐름에 대응).
 *   2) 브라우저에서 ZK 증명 생성 → `finalizeTournament{16|32|64}(tid, point, deadline, bracket, segment)`
 *      제출. witness(userSecret, voteSalt, eligibilityPath)는 브라우저를 떠나지 않는다.
 *   3) (row, salt) 를 PNYX escrow 에 위탁 — 모든 투표가 데이터 마켓 판매 대상.
 *
 * 진행 단계는 `phase` 로 노출해 Result 화면이 "증명 생성 중" 을 보여줄 수 있게 한다.
 */

import { useCallback, useRef, useState } from 'react';
import { api } from '~/lib/api';
import { useMidnight } from '~/components/providers/MidnightProvider';
import { getOrCreateUserSecret, newVoteSalt, pad32, toHex } from '~/lib/midnight/userKeys';

// midnight-js + compact-runtime(WASM) 은 무겁고 브라우저 전용 → 실제 finalize 시점에만 로드한다.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function confirmWithRetry(chainId: number, tournamentId: number, txId: string): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < 12; i++) {
    try {
      await api.signature.postFinalizeConfirm(chainId, { tournamentId, txId });
      return;
    } catch (e) {
      lastErr = e;
      await sleep(5_000);
    }
  }
  // 확정 통보 실패는 온체인 투표를 되돌리지 못한다 — 화면엔 성공으로 두고 경고만 남긴다(BE 가 재동기화 가능).
  console.warn('[finalize] confirm failed after retries (vote is on-chain):', lastErr);
}

const loadMidnight = () =>
  Promise.all([import('~/lib/midnight/providers'), import('~/lib/midnight/contract')]).then(
    ([providers, contract]) => ({ ...providers, ...contract }),
  );

export type FinalizePhase = 'idle' | 'granting' | 'joining' | 'proving' | 'submitting' | 'confirming' | 'escrowing' | 'done' | 'error';

export interface FinalizeParams {
  tournamentId: number;
  /** LWA final array — [0]=우승. 회로 인자이자 온체인 매치 카운터의 근거. 16/32/64강 */
  bracket: number[];
  /** 서버 검증·grant leaf 바인딩용 브라켓 인코딩(기존 tournamentData) */
  tournamentData: `0x${string}`;
  /** 1 집계만 · 2 세그먼트 · 3 로우 판매 동의 */
  segment?: string;
}

export const useFinalizeTournament = (
  chainId: number | undefined,
  onSuccess: (info: { txId: string }) => void,
  onError: (params: { transactionHash: string | undefined; error: unknown }) => void,
) => {
  const { wallet, address } = useMidnight();
  const [phase, setPhase] = useState<FinalizePhase>('idle');
  const [txId, setTxId] = useState<string | undefined>(undefined);
  const inFlight = useRef(false);

  const finalizeTournament = useCallback(async (p: FinalizeParams) => {
    if (!chainId) { onError({ transactionHash: undefined, error: new Error('Chain not connected') }); return; }
    if (!wallet || !address) { onError({ transactionHash: undefined, error: new Error('Wallet not connected') }); return; }
    if (![16, 32, 64].includes(p.bracket.length)) {
      // 사이즈별 회로(finalizeTournament16/32/64)만 존재 — 기획상 라운드 선택지와 동일
      onError({ transactionHash: undefined, error: new Error(`Unsupported round count: ${p.bracket.length} (16/32/64 only)`) });
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      setPhase('joining');
      const { buildTournamentFinalizerProviders, joinTournamentFinalizer, TF } = await loadMidnight();
      const userSecret = getOrCreateUserSecret(address);
      const voteSalt = newVoteSalt();
      const userPk = toHex(TF.pureCircuits.userPublicKey(userSecret));

      // 1) grant (BE → on-chain)
      setPhase('granting');
      const grant = await api.signature.postTournamentFinalize(chainId, {
        tournamentId: p.tournamentId,
        tournamentData: p.tournamentData,
        userPk,
      });
      const segment = p.segment ?? grant.segment ?? 'all';

      // 2) providers + join, then prove & submit
      const providers = await buildTournamentFinalizerProviders(wallet);
      const contract = await joinTournamentFinalizer(providers, { userSecret, voteSalt });

      setPhase('proving');
      const circuitName = `finalizeTournament${p.bracket.length}` as 'finalizeTournament16' | 'finalizeTournament32' | 'finalizeTournament64';
      const tx = await contract.callTx[circuitName](
        BigInt(p.tournamentId),
        BigInt(grant.point),
        BigInt(grant.deadline),
        p.bracket.map((id) => BigInt(id)),
        pad32(segment),
      );
      const id = tx.public.txId;
      setTxId(id);

      // 3) BE 에 확정 통보 → PlayInfo/포인트 반영 (인덱서 반영까지 몇 초 걸릴 수 있어 재시도)
      setPhase('confirming');
      await confirmWithRetry(chainId, p.tournamentId, id);

      // 4) escrow for data market — 모든 투표를 위탁 (제출 = 판매 대상)
      setPhase('escrowing');
      try {
        await api.signature.postEscrow(chainId, {
          tournamentId: p.tournamentId, itemId: p.bracket[0], segment, salt: toHex(voteSalt), txId: id, bracket: p.bracket,
        });
      } catch (e) {
        // escrow 실패는 투표 자체를 되돌리지 않는다 — 판매 대상에서만 빠진다.
        console.warn('[finalize] escrow failed (vote is on-chain):', e);
      }
      setPhase('done');
      onSuccess({ txId: id });
    } catch (error) {
      setPhase('error');
      onError({ transactionHash: txId, error });
      throw error;
    } finally {
      inFlight.current = false;
    }
  }, [chainId, wallet, address, onSuccess, onError, txId]);

  return { finalizeTournament, phase, txId };
};
