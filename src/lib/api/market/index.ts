/**
 * 데이터 마켓 API 모듈 — 상품 목록 / 주문 생성·결제·조회 / 데이터셋 다운로드.
 *
 * signature/index.ts 와 동일하게 `ApiResponse<T>` 로 감싸진 응답의 `.data` 만 언래핑해 반환한다.
 * dataset 다운로드만 예외 — BE 가 `@NoTransform` 으로 raw bytes attachment 를 내려주므로
 * `ApiResponse` 래핑이 없다(client.ts 의 `responseType:'blob'` 로 그대로 받는다).
 */

import { apiGet, apiPost } from '../client';
import type { ApiResponse } from '../types';

export interface MarketProduct {
  tournamentId: number;
  title: string;
  category: string;
  firstItemImageName: string | null;
  sampleCount: number;
  escrowRowCount: number;
  sellableRowCount: number;
  pricePerRowUnits: string;
  priceUnits: string;
  soldOut: boolean;
}

export type MarketOrderStatus = 'CREATED' | 'PAID' | 'FULFILLING' | 'FULFILLED' | 'FAILED';

export interface MarketOrder {
  orderId: string;
  tournamentId: number;
  status: MarketOrderStatus;
  stage: string;
  buyerPk: string;
  rowCount: number;
  sampleCountAtOrder: number;
  priceUnits: string;
  pricePerRowUnits: string;
  payTo: string;
  tokenTypeRaw: string;
  paymentTxId?: string;
  registerBuyerTxId?: string;
  sellTxId?: string;
  querySpec: string;
  specHash: string;
  licenseId?: string;
  datasetHash?: string;
  deliveredRowCount?: number;
  sampleAtSale?: number;
  error?: string;
  updatedAt: string;
}

/** `GET /chains/:chainId/market/products` — 판매 가능한 토너먼트 상품 목록. */
export async function getProducts(chainId: number): Promise<MarketProduct[]> {
  const res = await apiGet<ApiResponse<MarketProduct[]>>(`/chains/${chainId}/market/products`);
  return res.data;
}

/** `POST /chains/:chainId/market/orders` — 주문 생성(CREATED 상태는 멱등 재사용, BE 가 처리). */
export async function createOrder(chainId: number, tournamentId: number): Promise<MarketOrder> {
  const res = await apiPost<ApiResponse<MarketOrder>>(`/chains/${chainId}/market/orders`, { tournamentId });
  return res.data;
}

/** `POST /chains/:chainId/market/orders/:orderId/pay` — 결제 tx 기록 → BE 가 fulfill 큐에 enqueue. */
export async function payOrder(chainId: number, orderId: string, txId: string): Promise<MarketOrder> {
  const res = await apiPost<ApiResponse<MarketOrder>>(`/chains/${chainId}/market/orders/${orderId}/pay`, { txId });
  return res.data;
}

/** `GET /chains/:chainId/market/orders/:orderId` — 주문 상태 폴링. */
export async function getOrder(chainId: number, orderId: string): Promise<MarketOrder> {
  const res = await apiGet<ApiResponse<MarketOrder>>(`/chains/${chainId}/market/orders/${orderId}`);
  return res.data;
}

/**
 * `GET /chains/:chainId/market/orders/:orderId/dataset` — 완료된 주문의 데이터셋 바이트를 그대로 받는다.
 * client.ts 의 `apiGet<Blob>(..., { responseType: 'blob' })` 가 이미 blob 응답을 지원하므로
 * (files/index.ts 의 이미지 다운로드와 동일 패턴) 별도 fetch 구현이 필요 없다. FULFILLED 가 아니면 BE 가 409.
 */
export async function downloadDataset(chainId: number, orderId: string): Promise<Blob> {
  return apiGet<Blob>(`/chains/${chainId}/market/orders/${orderId}/dataset`, { responseType: 'blob' });
}
