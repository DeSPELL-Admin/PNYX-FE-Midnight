/**
 * User API 모듈 (지갑 주소 기반)
 *
 * fid 기반 Neynar API 호출 (getUsers/getUser/getUserStats/getBestFriends) 들은
 * Neynar 의존 제거와 함께 삭제됨.
 *
 * 신규 BE 는 사용자 신원을 JWT(`/me`)에서 도출한다. 따라서 chainId/address 는
 * 시그니처 호환을 위해 남겨두지만 URL 경로에는 더 이상 포함하지 않는다.
 */

import { apiGet } from '../client';
import { mockGetUserTournamentPlayDetail, mockGetUserTournaments } from '../_mocks/user';
import type { Tournament, PaginatedApiResponse, UserTournamentPlayDetail, TournamentType } from '../types';
import { USE_MOCK } from '../config';

/**
 * 내 토너먼트 목록 조회
 *
 * 신규 BE: `GET /me/tournaments?type&page&limit` (JWT 가 신원을 도출).
 * chainId/address 는 무시되지만 시그니처 호환을 위해 남겨둔다.
 * `type` 은 옵셔널 후행 파라미터(기본 `'classic'`).
 */
export async function getUserTournaments(
  chainId: number,
  address: string,
  page: number = 1,
  limit: number = 10,
  type: TournamentType = 'classic',
): Promise<PaginatedApiResponse<Tournament>> {
  if (USE_MOCK) return mockGetUserTournaments(chainId, address, page, limit);
  return apiGet(`/me/tournaments?page=${page}&limit=${limit}&type=${type}`);
}

/**
 * 내 토너먼트 플레이 상세 정보 조회
 *
 * 신규 BE: `GET /me/tournaments/:tournamentId/play-infos?page&limit` (JWT 신원).
 * chainId/address 는 무시되지만 시그니처 호환을 위해 남겨둔다.
 */
export async function getUserTournamentPlayDetail(
  chainId: number,
  address: string,
  tournamentId: number,
): Promise<PaginatedApiResponse<UserTournamentPlayDetail>> {
  if (USE_MOCK) return mockGetUserTournamentPlayDetail(chainId, address, tournamentId);
  return apiGet(`/me/tournaments/${tournamentId}/play-infos`);
}
