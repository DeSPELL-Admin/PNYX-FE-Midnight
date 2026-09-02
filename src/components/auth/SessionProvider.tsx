'use client';

/**
 * SessionProvider
 *
 * WagmiProvider(= wagmi + react-query 컨텍스트) 내부에 마운트되는 얇은 클라이언트
 * 컴포넌트. 유일한 책임은 fetch 레이어의 `setOnSessionExpired` 핸들러를 한 번 등록하는
 * 것이다. (세션 상태 자체는 `useAuthSession` 가 react-query 쿼리로 들고 있으므로,
 * 컴포넌트들은 이 프로바이더를 거치지 않고 훅을 직접 호출한다 — 별도 context 불필요.)
 *
 * 세션 만료(refresh 최종 실패) 시 핸들러 동작:
 *   1) signOut() — 로컬 세션을 미인증으로 환원 (logout 호출 + 세션 캐시 제거)
 *   2) queryClient.clear() — 이전 신원의 per-user 캐시 전부 폐기
 *   3) /login 으로 리다이렉트
 *
 * 게임 진행 상태는 useGameLogic 가 이미 localStorage(`game-progress`)에 매 투표마다
 * 저장하므로, 여기서는 그 저장소를 건드리지 않는다(wipe 금지) → 만료 리다이렉트
 * 이후에도 "이어하기"로 복원 가능. react-query 캐시만 비운다.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { setOnSessionExpired } from '~/lib/api/client';
import { useAuthSession } from '~/hooks/auth/useAuthSession';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { signOut } = useAuthSession();

  useEffect(() => {
    // 진짜 세션 만료(이전에 인증 성공 + refresh 최종 실패)에서만 호출된다.
    // (client.ts 의 hadSession 게이트가 미인증 401 발동을 막는다.)
    setOnSessionExpired(() => {
      // 이미 /login 이면 재리다이렉트/clear 불필요(방어적).
      if (typeof window !== 'undefined' && window.location.pathname === '/login') {
        return;
      }
      // 게임 진행 상태(localStorage)는 보존한다 — react-query 캐시만 비운다.
      void signOut();
      queryClient.clear();
      router.replace('/login');
    });

    return () => {
      // 언마운트 시 핸들러 해제 (HMR/중복 등록 방지)
      setOnSessionExpired(null);
    };
  }, [signOut, queryClient, router]);

  return <>{children}</>;
}
