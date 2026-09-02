/**
 * User 관련 훅 (지갑 주소 기반)
 *
 * fid 기반 Neynar API hook (useUsers/useUser/useUserStats/useBestFriends) 들은
 * Neynar 의존 제거와 함께 삭제됨. 사용자 정보는 모두 지갑 주소를 키로 다룬다.
 */

'use client';

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '~/lib/api';
import type { TournamentType } from '~/lib/api/types';

// Query Keys
export const userKeys = {
  all: ['user'] as const,
};

/**
 * 사용자 토너먼트 목록 조회 (`/me`, JWT 신원)
 *
 * per-user 데이터이므로 캐시 키에 address 를 포함한다(이미 포함). `type` 은
 * 옵셔널 후행 파라미터(기본 `'classic'`)로 키와 호출에 함께 스레딩한다.
 */
export function useUserTournaments(
  chainId: number | undefined,
  address: string | undefined,
  options?: { enabled?: boolean },
  type: TournamentType = 'classic'
) {
  return useInfiniteQuery({
    queryKey: [...userKeys.all, 'tournaments', chainId, address, type] as const,
    queryFn: ({ pageParam = 1 }) => api.user.getUserTournaments(chainId!, address!, pageParam, 10, type),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage || !lastPage.pagination || !lastPage.pagination.hasNext) return undefined;
      return lastPage.pagination.page + 1;
    },
    enabled: !!chainId && !!address && (options?.enabled ?? true),
  });
}

// useUserCompletedTournamentIds(클라이언트측 completedIds Set 핵)는 제거됨.
// 완료 여부는 이제 `GET /tournaments` 응답의 서버측 `status` 필드로 판정한다
// (TournamentList 에서 `t.status === 'completed'`).

/**
 * 사용자 지갑 주소별 토너먼트 플레이 상세 정보 조회
 */
export function useUserTournamentPlayDetail(
  chainId: number | undefined,
  address: string | undefined,
  tournamentId: number,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: [...userKeys.all, 'playDetail', chainId, address, tournamentId] as const,
    queryFn: () => api.user.getUserTournamentPlayDetail(chainId!, address!, tournamentId),
    enabled: !!chainId && !!address && (options?.enabled ?? true),
  });
}








