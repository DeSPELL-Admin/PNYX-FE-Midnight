"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Button from '~/components/ui/Button';
import { Spinner } from '~/components/ui/Spinner';
import { useMidnight } from '~/components/providers/MidnightProvider';
import { useAuthSession } from '~/hooks/auth/useAuthSession';
import { MIDNIGHT_NETWORK_ID } from '~/lib/midnight/config';

const LACE_INSTALL_URL = 'https://www.lace.io/';

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations('login');
  const { isConnected, isConnecting, isWalletAvailable, connect, error: connectError } = useMidnight();
  const [isMounted, setIsMounted] = useState(false);
  const { status, signIn, isSigningIn, error: signError } = useAuthSession();

  useEffect(() => { setIsMounted(true); }, []);

  // 인증 완료(서명 검증 + 쿠키 발급) 시에만 홈으로 보낸다.
  useEffect(() => {
    if (status === 'authenticated') router.replace('/');
  }, [status, router]);

  const handleConnect = () => { void connect().catch(() => { /* connectError 로 표시 */ }); };
  const handleSignIn = () => { void signIn().catch(() => { /* signError 로 표시 */ }); };

  if (!isMounted) return <Spinner />;

  return (
    <div className="flex flex-col items-center justify-end min-h-screen px-4 py-12 relative">
      <img
        src="/images/login.svg"
        alt="PNYX"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[142px] pointer-events-none select-none"
      />

      <div className="w-full max-w-xs space-y-3 z-10">
        {!isConnected && (
          isWalletAvailable ? (
            <Button fullWidth onClick={handleConnect} disabled={isConnecting} isLoading={isConnecting} variant="ctaYellow" size="lg">
              <div className="flex flex-col items-center leading-tight">
                <span>{t('connectLace')}</span>
                <span className="text-[10px] opacity-70 font-normal">{t('connectLaceSub', { network: MIDNIGHT_NETWORK_ID })}</span>
              </div>
            </Button>
          ) : (
            <a href={LACE_INSTALL_URL} target="_blank" rel="noreferrer" className="block">
              <Button fullWidth variant="ctaYellow" size="lg">
                <div className="flex flex-col items-center leading-tight">
                  <span>{t('installLace')}</span>
                  <span className="text-[10px] opacity-70 font-normal">{t('installLaceSub')}</span>
                </div>
              </Button>
            </a>
          )
        )}

        {isConnected && status !== 'authenticated' && (
          <div className="space-y-2">
            <Button fullWidth onClick={handleSignIn} disabled={isSigningIn || status === 'authenticating'} isLoading={isSigningIn} variant="ctaYellow" size="lg">
              <div className="flex flex-col items-center leading-tight">
                <span>{isSigningIn ? t('signingIn') : t('signIn')}</span>
                {!isSigningIn && <span className="text-[10px] opacity-70 font-normal">{t('signInSub')}</span>}
              </div>
            </Button>
            {signError && !isSigningIn && (
              <div className="space-y-2 rounded-[8px] border border-red-400/40 bg-red-500/10 px-3 py-2">
                <p className="text-[11px] text-red-300 text-center break-words">{t('signInFailed')}</p>
                <button type="button" onClick={handleSignIn} className="w-full text-[11px] font-semibold text-white underline underline-offset-2">
                  {t('signInRetry')}
                </button>
              </div>
            )}
          </div>
        )}

        {connectError && (
          <p className="text-[11px] text-red-400 text-center break-words">{connectError.message}</p>
        )}
      </div>
    </div>
  );
}
