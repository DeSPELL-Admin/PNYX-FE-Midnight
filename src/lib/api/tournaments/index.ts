import { apiGet } from "../client";
import {
  mockGetTournament,
  mockGetTournamentItemById,
  mockGetTournamentItemStatsById,
  mockGetTournaments,
  mockGetTournamentsRandomItems,
  mockGetTournamentStats,
} from "../_mocks/tournaments";
import { Tournament, PaginatedApiResponse, TournamentItemOpponentStat, TournamentItemStat, TournamentItem, ApiResponse, TournamentRandomItemIds, TournamentType } from "../types";
import { USE_MOCK } from "../config";

/**
 * 토너먼트 리스트 조회
 *
 * 신규 BE: `GET /tournaments?orderBy&type&page&limit` (체인 통합, JWT 게이트).
 * chainId 는 시그니처 호환을 위해 남겨두지만 URL 경로에는 더 이상 포함하지 않는다.
 * `type` 은 옵셔널 후행 파라미터(기본 `'classic'`)로 BE 의 타입 필터에 매핑된다.
 */
export async function getTournaments(chainId: number, page: number = 1, limit: number = 10, orderBy : 'POPULARITY' | 'LATEST' = 'POPULARITY', type: TournamentType = 'classic'): Promise<PaginatedApiResponse<Tournament>> {
  if (USE_MOCK) return mockGetTournaments(chainId, page, limit, orderBy);
  return apiGet(`/tournaments?page=${page}&limit=${limit}&orderBy=${orderBy}&type=${type}`);
}

/**
 * 특정 토너먼트 정보 조회
 *
 * 신규 BE: `GET /tournaments/:tournamentId` (chainId 경로 제거).
 */
export async function getTournament(chainId: number, tournamentId: number): Promise<ApiResponse<Tournament>> {
  if (USE_MOCK) return mockGetTournament(chainId, tournamentId);
  return apiGet(`/tournaments/${tournamentId}`);
}

/**
 * 특정 토너먼트의 라운드별 랜덤 아이템 ID 목록 조회
 *
 * 신규 BE: `GET /tournaments/:tournamentId/rounds/:roundCount` → `{ randomItemIds }`.
 * 이 인증 세션 하의 호출이 finalize 가 의존하는 서버측 playVerification 을 기록한다.
 */
export async function getTournamentsRandomItems(chainId: number, tournamentId: number, roundCount: number): Promise<ApiResponse<TournamentRandomItemIds>> {
  if (USE_MOCK) return mockGetTournamentsRandomItems(chainId, tournamentId, roundCount);
  return apiGet(`/tournaments/${tournamentId}/rounds/${roundCount}`);
}

/**
 * 특정 토너먼트의 특정 아이템 조회
 *
 * 신규 BE: `GET /tournaments/:tournamentId/items/:itemId` → `{ name, imageName }`.
 */
export async function getTournamentItemById(chainId: number, tournamentId: number, itemId: number): Promise<ApiResponse<TournamentItem>> {
  if (USE_MOCK) return mockGetTournamentItemById(chainId, tournamentId, itemId);
  return apiGet(`/tournaments/${tournamentId}/items/${itemId}`);
}


/**
 * 특정 토너먼트의 아이템 통계 조회
 *
 * 신규 BE: `GET /tournaments/:tournamentId/statistics?page&limit`.
 */
export async function getTournamentStats(chainId: number, tournamentId: number, page: number = 1, limit: number = 10): Promise<PaginatedApiResponse<TournamentItemStat>> {
  if (USE_MOCK) return mockGetTournamentStats(chainId, tournamentId, page, limit);
  return apiGet(`/tournaments/${tournamentId}/statistics?page=${page}&limit=${limit}`);
}


/**
 * 특정 토너먼트의 특정 아이템 통계 조회
 *
 * 신규 BE: `GET /tournaments/:tournamentId/items/:itemId/statistics?page&limit`.
 */
export async function getTournamentItemStatsById(chainId: number, tournamentId: number, itemId: number, page: number = 1, limit: number = 10): Promise<PaginatedApiResponse<TournamentItemOpponentStat>> {
  if (USE_MOCK) return mockGetTournamentItemStatsById(chainId, tournamentId, itemId, page, limit);
  return apiGet(`/tournaments/${tournamentId}/items/${itemId}/statistics?page=${page}&limit=${limit}`);
}
