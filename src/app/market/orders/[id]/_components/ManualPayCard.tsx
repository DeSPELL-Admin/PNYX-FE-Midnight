'use client';

/**
 * 수동 결제 카드 — 인페이지 결제(payOperator)가 실패했거나 지갑이 makeTransfer 를 지원하지 않을 때,
 * 사용자가 지갑 UI(Lace / 1AM)로 직접 송금하고 여기서 확인만 누르는 우회 경로.
 * payOperator 가 정상 동작하면 이 카드는 보이지 않는다(자동 결제가 pay 까지 마치고 PAID 로 넘어온다).
 * 송금은 나갔는데 BE 기록만 실패한 경우엔 useBuyDataset 이 남긴 txId 가 프리필된다 — 재송금 방지.
 */

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import Button from '~/components/ui/Button';
import { api } from '~/lib/api';
import type { MarketOrder } from '~/lib/api/market';
import { formatTNight } from '../../../_lib/format';
import { takePendingPaymentTx } from '~/hooks/market/pendingPaymentTx';

export default function ManualPayCard({ chainId, order, onPaid }: { chainId: number; order: MarketOrder; onPaid: () => void }) {
  const tMarket = useTranslations('market');
  // 자동 결제가 송금까지는 마쳤는데 BE 기록만 실패한 경우 useBuyDataset 이 남긴 txId 를 프리필 — 재송금 방지.
  const [txId, setTxId] = useState(() => takePendingPaymentTx(order.orderId) ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<'address' | 'amount' | null>(null);

  const copy = useCallback(async (kind: 'address' | 'amount', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard 미허용 환경 — 표시된 값을 직접 복사 */
    }
  }, []);

  const confirm = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.market.payOrder(chainId, order.orderId, txId.trim() || `manual-${Date.now().toString(16)}`);
      onPaid();
    } finally {
      setSubmitting(false);
    }
  }, [chainId, order.orderId, txId, submitting, onPaid]);

  const amountTNight = formatTNight(order.priceUnits);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-point-yellow/40 bg-brand-primary-800/40 p-4">
      <p className="text-[13px] font-[600] text-white">{tMarket('manualPayTitle')}</p>
      <p className="text-[12px] leading-relaxed text-brand-primary-300">{tMarket('manualPayDesc', { amount: amountTNight })}</p>

      <div className="flex flex-col gap-1">
        <span className="text-[11px] text-brand-primary-400">{tMarket('manualPayAddress')}</span>
        <button
          type="button"
          onClick={() => void copy('address', order.payTo)}
          className="break-all rounded-lg border border-brand-primary-700 bg-brand-primary-900/60 p-2 text-left text-[11px] text-brand-primary-100 transition-colors hover:border-point-yellow/60"
        >
          {order.payTo}
          <span className="ml-2 text-point-yellow">{copied === 'address' ? tMarket('copied') : tMarket('tapToCopy')}</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-brand-primary-400">{tMarket('manualPayAmount')}</span>
        <button
          type="button"
          onClick={() => void copy('amount', amountTNight)}
          className="rounded-lg border border-brand-primary-700 bg-brand-primary-900/60 px-2 py-1 text-[13px] font-[700] text-point-yellow transition-colors hover:border-point-yellow/60"
        >
          {amountTNight} tNIGHT
          <span className="ml-2 text-[10px] text-brand-primary-400">{copied === 'amount' ? tMarket('copied') : tMarket('tapToCopy')}</span>
        </button>
      </div>

      <input
        value={txId}
        onChange={(e) => setTxId(e.target.value)}
        placeholder={tMarket('manualPayTxIdPlaceholder')}
        className="rounded-lg border border-brand-primary-700 bg-brand-primary-900/60 p-2 text-[12px] text-brand-primary-100 placeholder:text-brand-primary-500 focus:border-point-yellow/60 focus:outline-none"
      />

      <Button variant="ctaYellow" isLoading={submitting} onClick={() => void confirm()}>
        {tMarket('manualPayConfirm')}
      </Button>
    </div>
  );
}
