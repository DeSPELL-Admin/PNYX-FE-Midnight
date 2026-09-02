'use client';

/**
 * AutoConnect (Midnight)
 *
 * 지갑 자동 연결은 MidnightProvider 가 담당한다(재방문 시 Lace 재연결). 여기서는 자동 로그인만:
 * 지갑이 연결됐는데 세션이 미인증이면 signIn 을 자동 트리거한다. 공개 라우트(/share)는 예외,
 * 주소당 1회. Startale/iframe 자동 연결 분기는 제거됐다.
 */

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAccount } from '~/hooks/wallet';
import { useAuthSession } from '~/hooks/auth/useAuthSession';
import { useToast } from '~/hooks/use-toast';

export function AutoConnect() {
  const pathname = usePathname();
  const { isConnected, address } = useAccount();
  const t = useTranslations('login');
  const { toast } = useToast();
  const { status, signIn } = useAuthSession();
  const attemptedForRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (pathname?.startsWith('/share')) return;
    if (!isConnected || !address) { attemptedForRef.current = undefined; return; }
    if (status !== 'unauthenticated') return;
    if (attemptedForRef.current === address) return;
    attemptedForRef.current = address;
    (async () => {
      try {
        await signIn();
      } catch (err) {
        console.error('[AutoConnect] auto sign-in failed:', err);
        toast({
          variant: 'destructive',
          title: t('signInFailed'),
          description: (err as { message?: string })?.message ?? t('unknownError'),
        });
      }
    })();
  }, [pathname, isConnected, address, status, signIn, toast, t]);

  return null;
}
