'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import CardSkeleton from '~/components/ui/CardSkeleton';
import EmptyState from '~/components/ui/EmptyState';
import { useAccount, useChainId } from '~/hooks/wallet';
import { useMarketProducts } from '~/hooks/market';
import { useBuyDataset } from '~/hooks/market/useBuyDataset';
import { useToast } from '~/hooks/use-toast';
import ProductCard from './_components/ProductCard';
import MyPurchases from './_components/MyPurchases';

// viem/unknown 에러를 사람이 읽을 수 있는 문자열로 안전 내로잉 (Result.tsx 의 resolveErrorMessage 와 동일 패턴).
function resolveErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { shortMessage?: unknown; message?: unknown };
    if (typeof e.shortMessage === 'string' && e.shortMessage) return e.shortMessage;
    if (typeof e.message === 'string' && e.message) return e.message;
  }
  return String(err);
}

export default function MarketPage() {
  const router = useRouter();
  const tMarket = useTranslations('market');
  const tError = useTranslations('error');
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { toast } = useToast();

  const { data: products, isLoading } = useMarketProducts(chainId);

  const [buyingTournamentId, setBuyingTournamentId] = useState<number | undefined>(undefined);

  const { buyDataset, phase } = useBuyDataset(
    chainId,
    ({ orderId }) => {
      setBuyingTournamentId(undefined);
      router.push(`/market/orders/${orderId}`);
    },
    ({ error }) => {
      setBuyingTournamentId(undefined);
      toast({
        variant: 'destructive',
        title: tError('title'),
        description: resolveErrorMessage(error) || tError('unknownError'),
      });
    },
  );

  const handleBuy = useCallback((tournamentId: number) => {
    if (!isConnected) {
      router.push('/login');
      return;
    }
    setBuyingTournamentId(tournamentId);
    void buyDataset(tournamentId).catch(() => { /* onError 가 토스트를 처리 */ });
  }, [isConnected, router, buyDataset]);

  return (
    <div className="flex flex-col gap-4">
      <div className="px-4 pt-2">
        <h1 className="text-[20px] font-[600] text-white">{tMarket('title')}</h1>
        <p className="mt-1 text-[13px] text-brand-primary-400">{tMarket('subtitle')}</p>
      </div>

      <div className="flex-1 px-4">
        {isLoading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        )}

        {!isLoading && (!products || products.length === 0) && (
          <EmptyState message={tMarket('emptyMessage')} />
        )}

        {!isLoading && products && products.length > 0 && (
          <div className="flex flex-col gap-3">
            {products.map((product) => (
              <ProductCard
                key={product.tournamentId}
                product={product}
                isConnected={isConnected}
                isBuying={buyingTournamentId === product.tournamentId}
                buyPhase={buyingTournamentId === product.tournamentId ? phase : 'idle'}
                onBuy={() => handleBuy(product.tournamentId)}
              />
            ))}
          </div>
        )}

        {!isLoading && <div className="mt-4"><MyPurchases /></div>}
      </div>
    </div>
  );
}
