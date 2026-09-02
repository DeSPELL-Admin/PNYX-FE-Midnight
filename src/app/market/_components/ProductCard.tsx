'use client';

import { useTranslations } from 'next-intl';
import ItemImage from '~/components/ui/ItemImage';
import Button from '~/components/ui/Button';
import { useImageFile } from '~/hooks';
import type { MarketProduct } from '~/lib/api/market';
import type { BuyDatasetPhase } from '~/hooks/market/useBuyDataset';
import { formatTNight } from '../_lib/format';

interface ProductCardProps {
  product: MarketProduct;
  isConnected: boolean;
  isBuying: boolean;
  buyPhase: BuyDatasetPhase;
  onBuy: () => void;
}

export default function ProductCard({ product, isConnected, isBuying, buyPhase, onBuy }: ProductCardProps) {
  const tMarket = useTranslations('market');
  const { data: imageUrl } = useImageFile(product.firstItemImageName ?? undefined);

  const phaseLabel = (p: BuyDatasetPhase) => {
    switch (p) {
      case 'creating': return tMarket('phaseCreating');
      case 'paying': return tMarket('phasePaying');
      case 'recording': return tMarket('phaseRecording');
      default: return tMarket('buy');
    }
  };

  const buttonLabel = !isConnected
    ? tMarket('connectToBuy')
    : product.soldOut
      ? tMarket('soldOut')
      : isBuying
        ? phaseLabel(buyPhase)
        : tMarket('buy');

  return (
    <div className="flex gap-3 rounded-xl border border-brand-primary-700 bg-brand-primary-800 p-2 overflow-hidden">
      <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg">
        <ItemImage src={imageUrl} alt={product.title} spinnerSize={20} />
        {product.soldOut && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
            <span className="rounded-full bg-brand-primary-900 px-2 py-0.5 text-[10px] font-[600] text-white">
              {tMarket('soldOut')}
            </span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div>
          <p className="line-clamp-2 text-[14px] font-[600] leading-tight text-white">{product.title}</p>
          <div className="mt-1 flex flex-col gap-0.5 text-[11px] text-brand-primary-400">
            <span>{tMarket('samples', { count: product.sampleCount })}</span>
            <span>
              {tMarket('sellableRows', { count: product.sellableRowCount })}
              {' · '}
              {tMarket('maxRowsHint')}
            </span>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-1">
            <span className="text-[15px] font-[700] text-point-yellow">{formatTNight(product.priceUnits)}</span>
            <span className="text-[10px] text-brand-primary-400">tNIGHT</span>
          </div>
          <Button
            variant="ctaYellow"
            size="sm"
            onClick={onBuy}
            isLoading={isBuying}
            disabled={product.soldOut || isBuying}
          >
            {buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
