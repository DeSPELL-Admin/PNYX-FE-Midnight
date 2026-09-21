"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Button from '~/components/ui/Button';
import { Spinner } from '~/components/ui/Spinner';
import { useMidnight } from '~/components/providers/MidnightProvider';
import { useAuthSession } from '~/hooks/auth/useAuthSession';
import { MIDNIGHT_NETWORK_ID } from '~/lib/midnight/config';

/** 감지된 지갑이 없을 때 안내할 설치 링크 — DApp connector v4 를 구현한 Midnight 지갑들 */
const INSTALL_LINKS = [
  { name: 'Lace', url: 'https://www.lace.io/' },
  { name: '1AM', url: 'https://1am.xyz/' },
];

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations('login');
  const { isConnected, isConnecting, wallets, connect, error: connectError } = useMidnight();
  const [isMounted, setIsMounted] = useState(false);
  const { status, signIn, isSigningIn, error: signError } = useAuthSession();

  useEffect(() => { setIsMounted(true); }, []);

  // 인증 완료(서명 검증 + 쿠키 발급) 시에만 홈으로 보낸다.
  useEffect(() => {
    if (status === 'authenticated') router.replace('/');
  }, [status, router]);

  const handleConnect = (rdns: string) => { void connect(rdns).catch(() => { /* connectError 로 표시 */ }); };
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
          wallets.length > 0 ? (
            wallets.map((w) => (
              <Button key={w.rdns} fullWidth onClick={() => handleConnect(w.rdns)} disabled={isConnecting} isLoading={isConnecting} variant="ctaYellow" size="lg">
                <div className="flex items-center justify-center gap-2">
                  {w.icon && <img src={w.icon} alt="" className="w-5 h-5 rounded" />}
                  <div className="flex flex-col items-center leading-tight">
                    <span>{t('connectWallet', { wallet: w.name })}</span>
                    <span className="text-[10px] opacity-70 font-normal">{t('connectWalletSub', { network: MIDNIGHT_NETWORK_ID })}</span>
                  </div>
                </div>
              </Button>
            ))
          ) : (
            <div className="space-y-2">
              {INSTALL_LINKS.map((link) => (
                <a key={link.name} href={link.url} target="_blank" rel="noreferrer" className="block">
                  <Button fullWidth variant="ctaYellow" size="lg">
                    <div className="flex flex-col items-center leading-tight">
                      <span>{t('installWallet', { wallet: link.name })}</span>
                      <span className="text-[10px] opacity-70 font-normal">{t('installWalletSub')}</span>
                    </div>
                  </Button>
                </a>
              ))}
            </div>
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
