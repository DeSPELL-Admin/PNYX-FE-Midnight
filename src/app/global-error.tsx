'use client';

/**
 * 전역 에러 바운더리.
 *
 * RootLayout 자체가 렌더에 실패한 경우 발동한다. 이때 NextIntlClientProvider 가
 * 마운트되지 않으므로 i18n(useTranslations) 을 쓸 수 없고, html/body 도 직접
 * 렌더해야 한다(Next.js 요구사항).
 *
 * 다크 UI 규칙: 배경 bg-primary, 텍스트 text-white. Tailwind 클래스에 의존하되
 * 최악의 경우(스타일시트 미로딩)에도 읽히도록 inline style 로 색을 보강한다.
 */

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global error boundary]', error);
  }, [error]);

  return (
    <html lang="en" translate="no">
      <body style={{ backgroundColor: '#191919', color: '#ffffff', margin: 0 }}>
        <div
          className="flex min-h-screen flex-col items-center justify-center bg-primary px-4 text-center text-white"
          style={{
            display: 'flex',
            minHeight: '100vh',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 1rem',
            textAlign: 'center',
          }}
        >
          <div className="flex max-w-xs flex-col items-center gap-4">
            <h2 className="text-xl font-bold text-white" style={{ fontWeight: 700, fontSize: '1.25rem' }}>
              Something went wrong
            </h2>
            <p
              className="text-sm leading-relaxed text-brand-primary-300"
              style={{ fontSize: '0.875rem', color: '#b3b3b3', margin: '0.75rem 0' }}
            >
              An unexpected error occurred. Please try again.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-[8px] bg-gradient-to-r from-point-yellow to-[#ECEAE7] px-6 py-3 font-semibold text-black"
              style={{
                borderRadius: '8px',
                padding: '0.75rem 1.5rem',
                fontWeight: 600,
                color: '#000000',
                background: 'linear-gradient(to right, #FCF4B3, #ECEAE7)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
