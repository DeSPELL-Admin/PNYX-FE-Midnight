/**
 * 데이터 마켓 훅 — 상품 목록 조회, 주문 폴링.
 *
 * useBuyDataset(구매 트랜잭션 플로우)는 배럴 재수출하지 않는다 — 별도 파일에서 직접 import.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '~/lib/api';
import type { MarketOrder } from '~/lib/api/market';

// Query Keys — tournamentKeys 스타일과 동일하게 chainId 를 포함해 체인 전환 시 캐시가 새지 않게 한다.
export const marketKeys = {
  all: ['market'] as const,
  products: (chainId: number | undefined) => [...marketKeys.all, 'products', chainId] as const,
  order: (chainId: number | undefined, orderId: string | undefined) => [...marketKeys.all, 'order', chainId, orderId] as const,
};

const TERMINAL_ORDER_STATUSES: readonly MarketOrder['status'][] = ['FULFILLED', 'FAILED'];

/** 판매 가능한 토너먼트 상품 목록 조회. */
export function useMarketProducts(chainId: number | undefined) {
  return useQuery({
    queryKey: marketKeys.products(chainId),
    queryFn: () => api.market.getProducts(chainId!),
    enabled: !!chainId,
  });
}

/**
 * 주문 상태 폴링. 종결 상태(FULFILLED/FAILED)에 도달하면 폴링을 멈춘다.
 * refetchInterval 을 함수형으로 둬 최신 캐시 데이터를 보고 매 틱마다 종결 여부를 재판단한다.
 */
export function useOrder(chainId: number | undefined, orderId: string | undefined) {
  return useQuery({
    queryKey: marketKeys.order(chainId, orderId),
    queryFn: () => api.market.getOrder(chainId!, orderId!),
    enabled: !!chainId && !!orderId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && TERMINAL_ORDER_STATUSES.includes(status)) return false;
      return 3000;
    },
  });
}
