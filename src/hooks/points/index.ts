/**
 * PNYX Point 훅 (Figma 32:5775 / 35:6652)
 *
 * usePoints: GET /me 를 통해 실시간 포인트 합계를 조회한다.
 *   반환 형태 `{ totalPoint: number }` 는 기존 소비처(mypage 카드·포인트 상세 페이지)와 동일.
 *
 * usePointHistory: BE 포인트 히스토리 엔드포인트 부재 — 총합만 실연동.
 *   빈 배열을 반환하며, 소비처(points/page.tsx)는 빈 내역을 EmptyState 로 처리한다.
 *
 * 진입점(My Point 카드)은 `features.useStartalePoints` 플래그(기본값 false,
 * env: NEXT_PUBLIC_USE_STARTALE_POINTS)로 가려 둔다 — 실제 게이팅은
 * `src/app/mypage/page.tsx` 의 카드 렌더 분기에서 수행한다.
 */

'use client';

import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMe } from '~/lib/api/auth';
import { authSessionKey } from '~/hooks/auth/useAuthSession';
import { subscribePendingReauth, getPendingReauth } from '~/lib/auth/reauth';

export interface PointHistoryEntry {
  id: string;
  /** 적립/사용 출처 라벨 (예: "Tournament(Classic)") */
  source: string;
  /** 변동량. 적립은 양수, 사용은 음수 */
  amount: number;
  /** ISO 날짜 (YYYY-MM-DD) */
  dateISO: string;
  /** 해당 시점 누적 잔액 */
  balance: number;
}

export const pointKeys = {
  all: ['points'] as const,
  // total 키는 제거됨 — 포인트 합계는 세션 쿼리(authSessionKey)를 공유한다.
  history: (address?: string) => [...pointKeys.all, 'history', address ?? null] as const,
};

/**
 * 보유 포인트 합계 — GET /me 에서 실시간 조회.
 *
 * 세션 프로브(useAuthSession)와 동일한 쿼리 키(authSessionKey)를 공유해 `/me`
 * 호출을 react-query 레벨에서 dedup 한다(중복 네트워크/독립 만료 트리거 제거).
 * `select` 로 `{ point }` → `{ totalPoint }` 변환(소비처 형태 유지). 주소 없으면 비활성.
 */
export function usePoints(address?: string) {
  // 지갑 전환 중 BE 세션 teardown(logout) 진행 플래그. 공유 키 프로브를 멈춘다.
  const pendingReauth = useSyncExternalStore(subscribePendingReauth, getPendingReauth, () => false);
  return useQuery({
    queryKey: authSessionKey(address),
    queryFn: getMe,
    enabled: !!address && !pendingReauth,
    staleTime: 60_000,
    select: (data): { totalPoint: number } => ({ totalPoint: data.point }),
  });
}

/**
 * 포인트 적립/사용 내역 (최신순).
 * BE 포인트 히스토리 엔드포인트 부재 — 총합만 실연동.
 * 빈 배열을 반환하고, UI 는 EmptyState 로 graceful 처리한다.
 */
export function usePointHistory(address?: string) {
  return useQuery({
    queryKey: pointKeys.history(address),
    queryFn: async (): Promise<PointHistoryEntry[]> => [],
    staleTime: 60_000,
  });
}
