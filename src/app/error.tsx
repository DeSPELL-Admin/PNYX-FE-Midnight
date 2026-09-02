'use client';

/**
 * 라우트 세그먼트 에러 바운더리.
 *
 * 렌더/데이터 예외를 잡아 백지 화면 대신 복구 UI를 보여 준다.
 * 이 컴포넌트는 RootLayout(=NextIntlClientProvider) 안에서 렌더되므로
 * useTranslations 사용이 가능하다. (루트 레이아웃 자체가 터지는 경우는
 * global-error.tsx 가 담당)
 *
 * 다크 UI 규칙: 배경은 항상 bg-primary, 텍스트는 명시적으로 text-white 사용.
 */

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Button from '~/components/ui/Button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errorBoundary');

  useEffect(() => {
    // 모니터링/디버깅용 로깅
    console.error('[error boundary]', error);
  }, [error]);

  return (
    <div className="flex min-h-[calc(100vh-140px)] flex-col items-center justify-center bg-primary px-4 text-center text-white">
      <div className="flex max-w-xs flex-col items-center gap-4">
        <h2 className="text-xl font-bold text-white">{t('heading')}</h2>
        <p className="text-sm leading-relaxed text-brand-primary-300">{t('body')}</p>
        <Button variant="ctaYellow" size="lg" onClick={() => reset()}>
          {t('retry')}
        </Button>
      </div>
    </div>
  );
}
