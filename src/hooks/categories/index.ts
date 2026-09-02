/**
 * Categories 관련 훅
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '~/lib/api';

// Query Keys
export const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  tournaments: (chainId: number, category: string) => [...categoryKeys.all, 'tournaments', chainId, category] as const,
};

/**
 * 카테고리 목록 조회
 */
export function useCategories(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: categoryKeys.lists(),
    queryFn: () => api.categories.getCategories(),
    enabled: options?.enabled ?? true,
    staleTime: 24 * 60 * 60 * 1000, // 24시간
  });
}

/**
 * 카테고리별 토너먼트 목록 조회
 */
export function useCategoryTournaments(
  chainId: number, 
  category: string | undefined, 
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: categoryKeys.tournaments(chainId, category!),
    queryFn: () => api.categories.getTournaments(chainId, category!),
    enabled: !!category && (options?.enabled ?? true),
  });
}
