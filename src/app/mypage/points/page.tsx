'use client';

import { notFound, useRouter } from 'next/navigation';
import { useAccount } from '~/hooks/wallet';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePoints, usePointHistory } from '~/hooks/points';
import { features } from '~/lib/feature-flags';
import EmptyState from '~/components/ui/EmptyState';

/**
 * 포인트 적립·사용 내역 (Figma 35:6652).
 * Total Point + 내역 리스트(출처/변동량 · 날짜/누적잔액). 데이터는 usePoints/usePointHistory.
 */

const numberFmt = new Intl.NumberFormat('en-US');
const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

export default function PointsPage() {
  const t = useTranslations('point');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { address } = useAccount();
  const { data: pointData } = usePoints(address);
  const { data: history, isLoading } = usePointHistory(address);
  const total = pointData?.totalPoint ?? 0;

  // useStartalePoints 플래그 off 시 직접 URL 진입도 차단 — mypage 카드와 동일 게이팅(H7)
  if (!features.useStartalePoints) notFound();

  return (
    <div className="pb-4">
      {/* 뒤로가기 */}
      <div className="flex items-center px-4 py-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={tCommon('back')}
          className="-ml-2 p-2 text-white"
        >
          <ArrowLeft size={24} />
        </button>
      </div>

      {/* Total Point */}
      <div className="px-5 pt-1">
        <p className="text-[16px] font-medium tracking-[-0.29px] text-brand-primary-400">{t('totalPoint')}</p>
        <div className="mt-1 flex items-end gap-[6px] text-white">
          <span className="text-[25px] font-semibold leading-none tracking-[-0.45px]">P</span>
          <span className="text-[31px] font-semibold leading-none tracking-[-0.56px]">{numberFmt.format(total)}</span>
        </div>
      </div>

      <div className="mt-5 h-px w-full bg-brand-primary-800" />

      {/* 적립·사용 내역 */}
      {!isLoading && (!history || history.length === 0) ? (
        <EmptyState message={t('empty')} />
      ) : (
        <ul className="flex flex-col gap-[19px] px-4 pt-5">
          {history?.map((e) => (
            <li key={e.id} className="flex flex-col gap-[5px]">
              <div className="flex items-center justify-between text-[16px] font-semibold tracking-[-0.29px] text-white">
                <span className="truncate pr-3">{e.source}</span>
                <span className="shrink-0">
                  {e.amount >= 0 ? `+${numberFmt.format(e.amount)}` : numberFmt.format(e.amount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[14px] font-medium tracking-[-0.25px] text-brand-primary-400">
                <span>{formatDate(e.dateISO)}</span>
                <span className="shrink-0">{numberFmt.format(e.balance)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
