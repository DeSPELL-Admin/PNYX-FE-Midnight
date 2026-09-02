import { apiGet } from "../client";
import { PaginatedApiResponse, Category, Tournament, TournamentType } from "../types";

/**
 * 카테고리 리스트 조회
 *
 * 신규 BE: `GET /categories?page&limit` (JWT 게이트).
 */
export async function getCategories(): Promise<PaginatedApiResponse<Category>> {
  return apiGet(`/categories`);
}

/**
 * 카테고리별 토너먼트 리스트 조회
 *
 * 신규 BE: `GET /categories/:category/tournaments?orderBy&type&page&limit` (chainId 경로 제거).
 * chainId 는 시그니처 호환을 위해 남겨두지만 URL 경로에는 더 이상 포함하지 않는다.
 * orderBy/page/limit/type 은 옵셔널 후행 파라미터(type 기본 `'classic'`).
 */
export async function getTournaments(
  chainId: number,
  category: string,
  orderBy: 'POPULARITY' | 'LATEST' = 'POPULARITY',
  page: number = 1,
  limit: number = 10,
  type: TournamentType = 'classic',
): Promise<PaginatedApiResponse<Tournament>> {
  return apiGet(`/categories/${category}/tournaments?orderBy=${orderBy}&type=${type}&page=${page}&limit=${limit}`);
}
