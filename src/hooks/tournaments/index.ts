/**
 * Tournaments 관련 훅
 */

'use client';

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useAccount } from '~/hooks/wallet';
import { api } from '~/lib/api';
import type { TournamentType } from '~/lib/api/types';

// Query Keys
export const tournamentKeys = {
  all: ['tournaments'] as const,
  // 리스트 응답은 로그인 유저의 per-user `status` 를 포함하므로, 신원(address)이
  // 캐시 키에 들어가야 주소 전환 시 status 가 새지 않는다. type 도 키에 포함.
  lists: (chainId: number | undefined, address: string | undefined, page: number, limit: number, orderBy: 'POPULARITY' | 'LATEST', type: TournamentType) => [...tournamentKeys.all, 'list', chainId, address, page, limit, orderBy, type] as const,
  tournament: (chainId: number | undefined, tournamentId: number) => [...tournamentKeys.all, 'tournament', chainId, tournamentId] as const,
  randomItems: (chainId: number | undefined, tournamentId: number, roundCount: number) => [...tournamentKeys.all, 'randomItems', chainId, tournamentId, roundCount] as const,
  item: (chainId: number | undefined, tournamentId: number, itemId: number | undefined) => [...tournamentKeys.all, 'item', chainId, tournamentId, itemId] as const,
  stats: (chainId: number | undefined, tournamentId: number) => [...tournamentKeys.all, 'stats', chainId, tournamentId] as const,
  itemStats: (chainId: number | undefined, tournamentId: number, itemId: number | undefined) => [...tournamentKeys.all, 'itemStats', chainId, tournamentId, itemId] as const,
};

/**
 * 토너먼트 리스트 조회
 *
 * 리스트 응답은 로그인 유저의 per-user `status` 를 포함하므로 신원(address)을
 * 캐시 키에 포함한다(주소는 wagmi `useAccount` 로 내부에서 읽는다). `type` 은
 * 옵셔널 후행 파라미터(기본 `'classic'`)로 BE 타입 필터에 매핑된다.
 */
export function useTournaments(chainId: number | undefined, page: number = 1, limit: number = 10, orderBy : 'POPULARITY' | 'LATEST' = 'POPULARITY', options?: { enabled?: boolean }, type: TournamentType = 'classic') {
  const { address } = useAccount();
  return useQuery({
    queryKey: tournamentKeys.lists(chainId, address, page, limit, orderBy, type),
    queryFn: () => api.tournaments.getTournaments(chainId!, page, limit, orderBy, type),
    enabled: !!chainId && (options?.enabled ?? true),
    staleTime: 30_000,
  });
}

/**
 * 특정 체인의 토너먼트 정보 조회
 */
export function useTournament(chainId: number | undefined, tournamentId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: tournamentKeys.tournament(chainId, tournamentId),
    queryFn: () => api.tournaments.getTournament(chainId!, tournamentId),
    enabled: !!chainId && (options?.enabled ?? true),
  });
}
/**
 * 카테고리 별 토너먼트 리스트 조회 (Random Items)
 */
export function useTournamentRandomItems(
  chainId: number | undefined,
  tournamentId: number,
  roundCount: number,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: tournamentKeys.randomItems(chainId, tournamentId, roundCount),
    queryFn: () => api.tournaments.getTournamentsRandomItems(chainId!, tournamentId, roundCount),
    enabled: !!chainId && !!tournamentId && (options?.enabled ?? true),
  });
}

/**
 * 특정 토너먼트의 특정 아이템 조회
 */
export function useTournamentItem(
  chainId: number | undefined,
  tournamentId: number,
  itemId: number,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: tournamentKeys.item(chainId, tournamentId, itemId),
    queryFn: () => api.tournaments.getTournamentItemById(chainId!, tournamentId, itemId),
    enabled: !!chainId && itemId >= 0 && (options?.enabled ?? true),
  });
}

/**
 * 특정 토너먼트의 아이템 통계 조회
 */
export function useTournamentStats(
  chainId: number | undefined,
  tournamentId: number,
  options?: { enabled?: boolean }
) {
  return useInfiniteQuery({
    queryKey: tournamentKeys.stats(chainId, tournamentId),
    queryFn: ({ pageParam = 1 }) => api.tournaments.getTournamentStats(chainId!, tournamentId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage || !lastPage.pagination.hasNext) return undefined;
      return lastPage.pagination.page + 1;
    },
    enabled: !!chainId && tournamentId >= 0 && (options?.enabled ?? true),
  });
}

/**
 * 특정 토너먼트의 특정 아이템 통계 조회
 */
export function useTournamentItemStats(
  chainId: number | undefined,
  tournamentId: number,
  itemId: number | undefined,
  options?: { enabled?: boolean }
) {
  return useInfiniteQuery({
    queryKey: tournamentKeys.itemStats(chainId, tournamentId, itemId),
    queryFn: ({ pageParam = 1 }) => api.tournaments.getTournamentItemStatsById(chainId!, tournamentId, itemId!, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage || !lastPage.pagination.hasNext) return undefined;
      return lastPage.pagination.page + 1;
    },
    enabled: !!chainId && itemId !== undefined && (options?.enabled ?? true),
  });
}
export * from './useGameLogic';
