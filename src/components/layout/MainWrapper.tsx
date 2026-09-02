"use client";

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

// 전체 화면을 사용하는 경로 (Header/Navbar 없음)
const FULLSCREEN_PATHS = ['/login', '/onboarding', '/champion/'];

interface MainWrapperProps {
  children: ReactNode;
}

export default function MainWrapper({ children }: MainWrapperProps) {
  const pathname = usePathname();

  // login, onboarding 페이지에서는 패딩 없이 전체 화면 사용
  const isFullscreen = FULLSCREEN_PATHS.some(path => pathname?.startsWith(path));

  return (
    <main className={`min-h-screen bg-primary ${isFullscreen ? '' : 'pt-[60px] pb-[80px]'}`}>
      {children}
    </main>
  );
}

