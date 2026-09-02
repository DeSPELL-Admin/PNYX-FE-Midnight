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
  myOrders: (chainId: number | undefined) => [...marketKeys.all, 'myOrders', chainId] as const,
  catalog: (chainId: number | undefined, orderId: string | undefined) => [...marketKeys.all, 'catalog', chainId, orderId] as const,
  dataset: (chainId: number | undefined, orderId: string | undefined) => [...marketKeys.all, 'dataset', chainId, orderId] as const,
};

// BE 가 스스로 진행시키는 상태만 폴링 대상 — CREATED 는 사용자가 결제해야 움직이므로 폴링해도 바뀌지 않는다.
const IN_PROGRESS_ORDER_STATUSES: readonly MarketOrder['status'][] = ['PAID', 'FULFILLING'];

/** 내 주문 목록(최신순). PAID/FULFILLING 주문이 있을 때만 5초 폴링. */
export function useMyOrders(chainId: number | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: marketKeys.myOrders(chainId),
    queryFn: () => api.market.getMyOrders(chainId!),
    enabled: !!chainId && (options?.enabled ?? true),
    refetchInterval: (query) => {
      const orders = query.state.data;
      if (!orders || !orders.some((o) => IN_PROGRESS_ORDER_STATUSES.includes(o.status))) return false;
      return 5000;
    },
  });
}

/** 주문 소유자 전용 카탈로그(아이템 이름·이미지). 소유자가 아니면 BE 가 403 → isError. */
export function useOrderCatalog(chainId: number | undefined, orderId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: marketKeys.catalog(chainId, orderId),
    queryFn: () => api.market.getOrderCatalog(chainId!, orderId!),
    enabled: !!chainId && !!orderId && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

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
    // 403/404(남의 주문·없는 주문)는 재시도해도 같으므로 즉시 에러 UI 로.
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && TERMINAL_ORDER_STATUSES.includes(status)) return false;
      return 3000;
    },
  });
}
