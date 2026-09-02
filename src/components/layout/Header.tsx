"use client";

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import Search from '~/assets/icons/search.svg'
import Notification from '~/assets/icons/notifications.svg'
import { APP_NAME } from '~/lib/constants';
import IconButton from '~/components/ui/IconButton';
import Image from 'next/image';

// SearchModal 은 전 페이지에 상주하지만 열기 전엔 필요 없으므로 클라이언트에서만 동적 로드 (M12)
const SearchModal = dynamic(() => import('~/components/modals/SearchModal'), { ssr: false });
// Header를 숨길 경로
const HIDDEN_PATHS = ['/login', '/onboarding', '/champion/'];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const tCommon = useTranslations('common');
  const tHeader = useTranslations('header');
  const [isVisible, setIsVisible] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  // login, onboarding 페이지에서는 Header 숨기기
  const shouldHide = HIDDEN_PATHS.some(path => pathname?.startsWith(path));

  useEffect(() => {
    // 스크롤 방향에 따라 헤더 표시/숨김. lastScrollY 를 ref 가 아닌
    // 함수형 setState 로 비교해 리스너를 한 번만 등록한다.
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY <= 0) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsVisible(false);
      } else if (currentScrollY < lastScrollY) {
        setIsVisible(true);
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // login, onboarding 페이지에서는 렌더링하지 않음
  if (shouldHide) {
    return null;
  }

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 mx-auto max-w-[430px] transition-transform duration-300 ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="flex items-center justify-between px-4 py-3">
          {/* Logo Name */}
          <div className="flex items-center" onClick={() => router.push('/')}>
            <Image src="/logo.png" alt={APP_NAME} width={60} height={100} className="text-xl font-bold text-white hover:opacity-90 transition-opacity" />
          </div>

          {/* Actions: Search, Notification */}
          <div className="flex items-center gap-1 relative">
            <IconButton
              onClick={() => setIsNotificationOpen(!isNotificationOpen)}
              className="-mr-2 relative"
              aria-label={tHeader('notifications')}
            >
              <Notification className="w-6 h-6" />
            </IconButton>

            {isNotificationOpen && (
              <div className="absolute top-[120%] right-0 w-[320px] bg-white text-gray-900 rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                  <span className="font-bold text-base">{tHeader('notifications')}</span>
                  <button className="text-xs text-brand-primary-500 hover:text-brand-primary-700 font-medium transition-colors">
                    {tHeader('markAllRead')}
                  </button>
                </div>
                <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
                  <div className="py-16 px-6 flex flex-col items-center justify-center text-gray-400 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center">
                      <Notification className="w-8 h-8 text-gray-300" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-900 mb-1">{tHeader('noNewNotifications')}</p>
                      <p className="text-xs text-gray-500">
                        {tHeader('stayTuned')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <IconButton
              onClick={() => setIsSearchOpen(true)}
              aria-label={tCommon('search')}
            >
              <Search className="w-6 h-6" />
            </IconButton>

          </div>
        </div>
      </header>

      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
