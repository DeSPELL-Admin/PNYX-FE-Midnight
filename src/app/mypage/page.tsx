"use client";

import { useAccount, useDisconnect } from '~/hooks/wallet';
import { Wifi, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import User from '~/assets/icons/mypageBlack.svg'
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '~/components/ui/Modal';
import { usePoints } from '~/hooks/points';
import { features } from '~/lib/feature-flags';
import NetworkSwitcher from '~/components/NetworkSwitcher';
import LanguageToggle from '~/components/setting/LanguageToggle';
import { useToast } from '~/hooks/use-toast';
import { useAuthSession } from '~/hooks/auth/useAuthSession';
import { clearWalletStorage } from '~/lib/auth/walletStorage';

export default function MyPage() {
  const t = useTranslations('mypage');
  const tCommon = useTranslations('common');
  const tPoint = useTranslations('point');
  const { address } = useAccount();
  const { data: pointData } = usePoints(address);
  const { disconnectAsync, isPending: isDisconnecting } = useDisconnect();
  const { signOut } = useAuthSession();
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const menuItems = [
    { icon: Wifi, label: t('network'), onClick: () => setIsNetworkModalOpen(true) },
    // My Contents 는 아직 미출시 → coming soon 안내 (cc. 0608 기획)
    { icon: null, label: t('myContents'), onClick: () => toast({ title: t('myContents'), description: tCommon('comingSoon') }) },
    // Transaction 은 전당(Hall) 결과지 페이지(View transaction 링크)로 이전됨 → mypage 메뉴 제거 (0608 Phase 2)
    { icon: null, label: t('terms'), onClick: () => setIsTermsModalOpen(true) },
  ];

  const formatAddress = (addr: string | undefined) => {
    if (!addr) return t('unknownWallet');
    return `${addr.slice(0, 14)}…${addr.slice(-6)}`;
  };

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      // 1) BE 세션 정리: /auth/logout 으로 access/refresh 쿠키 clear + DB refresh token revoke.
      //    쿠키는 HttpOnly 라 JS 가 못 지우므로 BE 호출이 유일한 토큰 정리 수단이다.
      //    (signOut 내부에서 실패해도 로컬 세션은 미인증으로 환원 — throw 하지 않음)
      await signOut();
      // 2) 지갑 연결 해제 + 지갑 로컬 스토리지 정리.
      await disconnectAsync();
      clearWalletStorage();
      router.replace('/login');
    } catch (error) {
      console.error('Sign out failed:', error);
      toast({ title: t('signOutFailed'), description: t('tryAgain') });
      setIsSigningOut(false);
    }
  }, [signOut, disconnectAsync, isSigningOut, router, toast, t]);

  return (
    <div className="pb-24">
      {/* Profile Card */}
      <div className="px-4">
        <div className="">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="">
              <div className="w-20 h-20 rounded-full p-0.5">
                <div className="w-full h-full rounded-full flex items-center justify-center ">
                  <User className="text-white" width={80} height={80} fill={"black"} />
                </div>
              </div>
            </div>

            {/* User Info */}
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white truncate">
                {formatAddress(address)}
              </h1>
              <p className="text-sm text-brand-primary-400">
                {t('walletUser')}
              </p>
            </div>
          </div>


        </div>
      </div>

      {/* My Point (Figma 32:5775) — features.useStartalePoints 플래그로 게이팅.
          BE 포인트 API 준비 전까지 usePoints 는 mock 을 반환하므로, 플래그가 꺼진
          기본 상태에서는 mock 포인트가 노출되지 않도록 카드 + 상세 라우트 진입을 가린다. */}
      {features.useStartalePoints && (
        <div className="mt-6 px-4">
          <Link href="/mypage/points" className="block">
            <div
              className="relative h-[105px] w-full rounded-[12px]"
              style={{ backgroundImage: 'linear-gradient(95deg, #FCF4B3 0%, #ECEAE7 100%)' }}
            >
              <span className="absolute left-5 top-3.5 text-[14px] font-semibold tracking-[-0.25px] text-brand-primary-600">
                {tPoint('myPoint')}
              </span>
              <div className="absolute inset-x-[22px] top-[37px] flex items-center justify-between">
                <div className="flex items-end gap-[6px] text-[#222222]">
                  <span className="text-[25px] font-semibold leading-none tracking-[-0.45px]">P</span>
                  <span className="text-[31px] font-semibold leading-none tracking-[-0.56px]">
                    {(pointData?.totalPoint ?? 0).toLocaleString('en-US')}
                  </span>
                </div>
                <ChevronRight className="h-5 w-5 text-[#222222]" />
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Language Section */}
      <div className="mt-6 px-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-white text-[16px]">{t('language')}</span>
          <LanguageToggle />
        </div>
      </div>

      {/* Menu Section */}
      <div className="mt-6">
        <div className="rounded-2xl overflow-hidden">
          {menuItems.map((item, index) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className={`w-full flex items-center gap-4 p-4 transition-colors hover:bg-brand-primary-800 ${index !== menuItems.length - 1 ? '' : ''
                }`}
            >

              <span className="flex-1 text-left font-semibold text-white text-[16px]">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Logout Button */}
      <div className="mt-6">
        <div className="rounded-2xl overflow-hidden">
          <button
            className="w-full flex items-center gap-4 p-4 transition-colors hover:bg-brand-primary-800 disabled:opacity-50"
            onClick={handleSignOut}
            disabled={isSigningOut || isDisconnecting}
          >
            <span className="flex-1 text-left font-semibold text-white text-[16px]">
              {isSigningOut ? t('signingOut') : t('signOut')}
            </span>
          </button>
        </div>
      </div>

      <Modal isOpen={isNetworkModalOpen} onClose={() => setIsNetworkModalOpen(false)}>
        <NetworkSwitcher />
      </Modal>

      <Modal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)}>
        {/* Terms of Service — 법무 카피 도착 시 termsPlaceholder 자리를 실제 약관으로 교체 (0608 STORY3-14) */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-white">{t('terms')}</h2>
          <p className="text-sm leading-relaxed text-brand-primary-300 whitespace-pre-line">
            {t('termsPlaceholder')}
          </p>
          <button
            type="button"
            onClick={() => setIsTermsModalOpen(false)}
            className="mt-1 w-full rounded-[8px] bg-brand-primary-800 py-3 font-semibold text-white hover:bg-brand-primary-700"
          >
            {tCommon('close')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
