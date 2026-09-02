'use client';

import { use } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import IconButton from '~/components/ui/IconButton';
import { Spinner } from '~/components/ui/Spinner';
import { useChainId } from '~/hooks/wallet';
import { useOrder } from '~/hooks/market';
import { useTournament } from '~/hooks';
import type { MarketOrderStatus } from '~/lib/api/market';
import { formatTNight } from '../../_lib/format';
import OrderProgress from './_components/OrderProgress';
import ManualPayCard from './_components/ManualPayCard';

// 검증 패널은 WASM(midnight-js)을 태우므로 클라이언트 전용 동적 로드 (M12 / FE CLAUDE.md 규칙).
const VerifyPanel = dynamic(() => import('./_components/VerifyPanel'), { ssr: false });

const STATUS_STYLE: Record<MarketOrderStatus, string> = {
  CREATED: 'bg-brand-primary-700 text-brand-primary-300',
  PAID: 'bg-point-yellow/20 text-point-yellow',
  FULFILLING: 'bg-point-yellow/20 text-point-yellow',
  FULFILLED: 'bg-point-green/20 text-point-green',
  FAILED: 'bg-red-400/20 text-red-400',
};

export default function MarketOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const tMarket = useTranslations('market');
  const tCommon = useTranslations('common');
  const { id } = use(params);

  const chainId = useChainId();
  const { data: order, isLoading, isError, refetch } = useOrder(chainId, id);
  const { data: tournamentData } = useTournament(chainId, order?.tournamentId ?? 0, { enabled: !!order });

  const statusLabel = (s: MarketOrderStatus) => {
    switch (s) {
      case 'CREATED': return tMarket('statusCreated');
      case 'PAID': return tMarket('statusPaid');
      case 'FULFILLING': return tMarket('statusFulfilling');
      case 'FULFILLED': return tMarket('statusFulfilled');
      case 'FAILED': return tMarket('statusFailed');
    }
  };

  return (
    <div className="min-h-screen mx-auto max-w-[430px] bg-primary flex flex-col animate-in fade-in duration-200">
      <div className="flex items-center p-4">
        <IconButton onClick={() => router.back()} className="-ml-2" aria-label={tCommon('back')}>
          <ArrowLeft size={24} />
        </IconButton>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Spinner size={28} className="text-brand-primary-400" />
          </div>
        )}

        {!isLoading && (isError || !order) && (
          <p className="py-16 text-center text-[13px] text-brand-primary-400">{tMarket('orderLoadFailed')}</p>
        )}

        {!isLoading && order && (
          <>
            <div className="space-y-2 rounded-xl border border-brand-primary-700 bg-brand-primary-800/60 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[15px] font-[600] text-white">
                  {tournamentData?.data?.title ?? tMarket('orderFallbackTitle', { id: order.tournamentId })}
                </p>
                <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-[600] ${STATUS_STYLE[order.status]}`}>
                  {statusLabel(order.status)}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[18px] font-[700] text-point-yellow">{formatTNight(order.priceUnits)}</span>
                <span className="text-[11px] text-brand-primary-400">tNIGHT</span>
              </div>
              <p className="break-all text-[11px] text-brand-primary-500">
                {tMarket('orderId')}: {order.orderId}
              </p>
            </div>

            {order.status === 'CREATED' && chainId !== undefined && (
              <ManualPayCard chainId={chainId} order={order} onPaid={() => void refetch()} />
            )}

            <OrderProgress order={order} />

            {order.status === 'FAILED' && (
              <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-3">
                <p className="break-words text-[12px] text-red-300">{order.error || tMarket('orderFailedGeneric')}</p>
              </div>
            )}

            {order.status === 'FULFILLED' && chainId !== undefined && (
              <VerifyPanel chainId={chainId} order={order} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
