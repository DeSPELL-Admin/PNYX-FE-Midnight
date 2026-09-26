'use client';

import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { Spinner } from '~/components/ui/Spinner';
import type { MarketOrder } from '~/lib/api/market';

// BE fulfill 상태머신(market-dev-plan.md §2 stage) 을 FE 타임라인 6단계로 매핑.
// 'queued' 는 결제 직후(PAID) → registerBuyer 전 단계이므로 '결제 기록' 스텝으로 표시한다.
const STEP_KEYS = ['paid', 'registering', 'building', 'proving', 'confirming', 'done'] as const;
type StepKey = typeof STEP_KEYS[number];

const STAGE_TO_STEP: Record<string, number> = {
  queued: 0,
  registering: 1,
  building: 2,
  proving: 3,
  confirming: 4,
  done: 5,
};

// 현재 활성 스텝 인덱스. CREATED(결제 전)는 -1, FULFILLED 는 마지막 스텝 확정.
function resolveStepIndex(order: MarketOrder): number {
  if (order.status === 'FULFILLED') return STEP_KEYS.length - 1;
  if (order.status === 'CREATED') return -1;
  const idx = STAGE_TO_STEP[order.stage];
  return idx === undefined ? 0 : idx;
}

function shortenTxId(txId?: string): string | undefined {
  if (!txId) return undefined;
  if (txId.length <= 16) return txId;
  return `${txId.slice(0, 8)}…${txId.slice(-6)}`;
}

interface OrderProgressProps {
  order: MarketOrder;
}

export default function OrderProgress({ order }: OrderProgressProps) {
  const tMarket = useTranslations('market');
  const activeIndex = resolveStepIndex(order);
  const isFailed = order.status === 'FAILED';
  // FULFILLED 는 진행 중인 스텝이 없다 — 마지막 'done' 포함 전부 체크(스피너 없음).
  const isFulfilled = order.status === 'FULFILLED';
  const failedIndex = Math.max(activeIndex, 0);

  const stepLabel = (key: StepKey) => {
    switch (key) {
      case 'paid': return tMarket('stepPaid');
      case 'registering': return tMarket('stepRegistering');
      case 'building': return tMarket('stepBuilding');
      case 'proving': return tMarket('stepProving');
      case 'confirming': return tMarket('stepConfirming');
      case 'done': return tMarket('stepDone');
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-brand-primary-700 bg-brand-primary-800/60 p-4">
      {STEP_KEYS.map((key, i) => {
        const isDone = !isFailed && (isFulfilled || i < activeIndex);
        const isCurrent = !isFailed && !isFulfilled && i === activeIndex;
        const isFailedHere = isFailed && i === failedIndex;
        const isFuture = !isDone && !isCurrent && !isFailedHere;

        return (
          <div key={key} className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border ${
                isDone
                  ? 'border-point-green bg-point-green/20 text-point-green'
                  : isCurrent
                    ? 'border-point-yellow text-point-yellow'
                    : isFailedHere
                      ? 'border-red-400 bg-red-400/20 text-red-400'
                      : 'border-brand-primary-600 text-brand-primary-600'
              }`}
            >
              {isDone && <Check size={12} />}
              {isCurrent && <Spinner size={12} />}
              {isFailedHere && <X size={12} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-[13px] font-[600] ${isFuture ? 'text-brand-primary-500' : 'text-white'}`}>
                {stepLabel(key)}
              </p>
              {key === 'proving' && isCurrent && (
                <p className="mt-0.5 text-[11px] text-brand-primary-400">{tMarket('provingHint')}</p>
              )}
              {key === 'registering' && order.registerBuyerTxId && (
                <p className="mt-0.5 font-mono text-[10px] text-brand-primary-500">
                  {shortenTxId(order.registerBuyerTxId)}
                </p>
              )}
              {(key === 'confirming' || key === 'done') && order.sellTxId && (
                <p className="mt-0.5 font-mono text-[10px] text-brand-primary-500">
                  {shortenTxId(order.sellTxId)}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
