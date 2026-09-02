'use client';

import { use } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import IconButton from '~/components/ui/IconButton';
import { Spinner } from '~/components/ui/Spinner';

// 본문은 온체인 커밋 대조(checkRowCommit → WASM)를 태우므로 클라이언트 전용 동적 로드
// (FE CLAUDE.md 규칙 — 주문 상세의 VerifyPanel 과 동일).
const DatasetView = dynamic(() => import('./_components/DatasetView'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-16">
      <Spinner size={28} className="text-brand-primary-400" />
    </div>
  ),
});

export default function MarketOrderDataPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const { id } = use(params);

  return (
    <div className="min-h-screen mx-auto max-w-[430px] bg-primary flex flex-col animate-in fade-in duration-200">
      <div className="flex items-center p-4">
        <IconButton onClick={() => router.back()} className="-ml-2" aria-label={tCommon('back')}>
          <ArrowLeft size={24} />
        </IconButton>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <DatasetView orderId={id} />
      </div>
    </div>
  );
}
