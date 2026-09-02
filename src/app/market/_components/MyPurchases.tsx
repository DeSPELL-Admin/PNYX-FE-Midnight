'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import ItemImage from '~/components/ui/ItemImage';
import CardSkeleton from '~/components/ui/CardSkeleton';
import { useImageFile } from '~/hooks';
import { useAccount, useChainId } from '~/hooks/wallet';
import { useMarketProducts, useMyOrders } from '~/hooks/market';
import type { MarketOrder, MarketOrderStatus, MarketProduct } from '~/lib/api/market';
import { formatTNight } from '../_lib/format';

// orders/[id]/page.tsx 의 STATUS_STYLE 과 동일한 색상 규칙.
const STATUS_STYLE: Record<MarketOrderStatus, string> = {
  CREATED: 'bg-brand-primary-700 text-brand-primary-300',
  PAID: 'bg-point-yellow/20 text-point-yellow',
  FULFILLING: 'bg-point-yellow/20 text-point-yellow',
  FULFILLED: 'bg-point-green/20 text-point-green',
  FAILED: 'bg-red-400/20 text-red-400',
};

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface PurchaseCardProps {
  order: MarketOrder;
  product?: MarketProduct;
}

function PurchaseCard({ order, product }: PurchaseCardProps) {
  const router = useRouter();
  const tMarket = useTranslations('market');
  const { data: imageUrl } = useImageFile(product?.firstItemImageName ?? undefined);

  const title = product?.title ?? tMarket('orderFallbackTitle', { id: order.tournamentId });
  const isFulfilled = order.status === 'FULFILLED';
  const destination = isFulfilled ? `/market/orders/${order.orderId}/data` : `/market/orders/${order.orderId}`;

  const statusLabel = (s: MarketOrderStatus) => {
    switch (s) {
      case 'CREATED': return tMarket('statusCreated');
      case 'PAID': return tMarket('statusPaid');
      case 'FULFILLING': return tMarket('statusFulfilling');
      case 'FULFILLED': return tMarket('statusFulfilled');
      case 'FAILED': return tMarket('statusFailed');
    }
  };

  const subtitle = () => {
    if (order.status === 'FULFILLED') {
      return `${tMarket('purchasesRows', { count: order.rowCount })} · ${formatTNight(order.priceUnits)} tNIGHT · ${shortDate(order.updatedAt)}`;
    }
    if (order.status === 'CREATED') {
      return tMarket('purchasesAwaitingPayment');
    }
    if (order.stage === 'proving') {
      return `${tMarket('stepProving')} · ${tMarket('provingHint')}`;
    }
    switch (order.stage) {
      case 'registering': return tMarket('stepRegistering');
      case 'building': return tMarket('stepBuilding');
      case 'confirming':
      case 'done': return tMarket('stepConfirming');
      default: return tMarket('purchasesAwaitingPayment');
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(destination)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') router.push(destination);
      }}
      className="flex cursor-pointer items-center gap-3 rounded-xl border border-brand-primary-700 bg-brand-primary-800/60 p-3"
    >
      <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg">
        <ItemImage src={imageUrl} alt={title} spinnerSize={16} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[13px] font-[600] text-white">{title}</p>
          <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-[600] ${STATUS_STYLE[order.status]}`}>
            {statusLabel(order.status)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-brand-primary-500">{subtitle()}</p>
      </div>

      <span className={`flex-shrink-0 text-[11px] font-[600] ${isFulfilled ? 'text-point-yellow' : 'text-brand-primary-400'}`}>
        {isFulfilled ? tMarket('purchasesViewData') : tMarket('purchasesTrack')}
      </span>
    </div>
  );
}

export default function MyPurchases() {
  const tMarket = useTranslations('market');
  const chainId = useChainId();
  const { isConnected } = useAccount();

  const { data: products } = useMarketProducts(chainId);
  const { data: orders, isLoading } = useMyOrders(chainId, { enabled: isConnected });

  if (!isConnected) return null;
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-[600] text-white">{tMarket('purchasesTitle')}</h2>
        </div>
        <CardSkeleton />
      </div>
    );
  }
  if (!orders || orders.length === 0) return null;

  const productByTournamentId = new Map((products ?? []).map((p) => [p.tournamentId, p]));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-[600] text-white">{tMarket('purchasesTitle')}</h2>
        <span className="text-[11px] text-brand-primary-500">{tMarket('purchasesCount', { count: orders.length })}</span>
      </div>
      <div className="flex flex-col gap-2">
        {orders.map((order) => (
          <PurchaseCard key={order.orderId} order={order} product={productByTournamentId.get(order.tournamentId)} />
        ))}
      </div>
    </div>
  );
}
