/**
 * Eligibility API 모듈 (Midnight — 백엔드 EIP-712 서명의 대체)
 *
 * 기존 EVM 흐름에서는 BE 가 finalize 서명을 발급해 FE 가 컨트랙트에 넘겼다. Midnight 에선 BE(오퍼레이터)가
 * `eligibilityLeaf(domainTag, userPk, tournamentId, point, deadline)` 를 계산해 **온체인 트리에 삽입**
 * (`grantEligibility`)하고, FE 는 그 `{ point, deadline }` 로 ZK 증명을 만들어 `finalizeTournament` 를
 * 호출한다. 라우트는 그대로 `POST /chains/:chainId/signatures/tournament-finalize` 를 쓴다
 * (chainId = 합성 Midnight chainId).
 *
 * body: `{ tournamentId, tournamentData, userPk }` — userPk 는 `pureCircuits.userPublicKey(userSecret)`,
 *   secret 자체는 절대 보내지 않는다. tournamentData 는 서버측 playVerification 대조용(기존과 동일).
 */

import { apiPost } from '../client';
import type { ApiResponse } from '../types';

export interface FinalizeGrant {
  /** 이미 같은 (user, tournament) 로 grant 가 있어 재사용했는지 */
  exists: boolean;
  /** grant 를 삽입한 Midnight tx id (재사용 시 이전 tx) */
  txId: string | null;
  /** 컨트랙트 인자 — leaf 에 바인딩된 값들 */
  point: string;
  deadline: string;
  /** escrow 위탁분에 들어가는 서버 권장 세그먼트 태그 (없으면 "all") */
  segment: string | null;
}

export interface TournamentFinalizeBody {
  tournamentId: number;
  tournamentData: `0x${string}`;
  userPk: string;
}

export async function postTournamentFinalize(chainId: number, body: TournamentFinalizeBody): Promise<FinalizeGrant> {
  const res = await apiPost<ApiResponse<FinalizeGrant>>(`/chains/${chainId}/signatures/tournament-finalize`, body);
  return res.data;
}

/** 투표의 (row, salt) 를 PNYX escrow 에 위탁한다 — 모든 투표가 판매 대상. 커밋은 이미 온체인. */
export interface EscrowBody {
  tournamentId: number;
  itemId: number;
  segment: string;
  salt: string; // hex
  txId: string;
  /** LWA final array — 브라켓 전체가 커밋 안에 봉인되므로(B안) 검증엔 필수. 16/32/64강. */
  bracket: number[];
}

export async function postEscrow(chainId: number, body: EscrowBody): Promise<void> {
  await apiPost<ApiResponse<unknown>>(`/chains/${chainId}/escrow`, body);
}

/**
 * finalizeTournament 제출 후 BE 에 txId 를 알린다. BE 가 인덱서로 tx 를 확인하고 PlayInfo/포인트/통계를
 * 갱신한다(체인 이벤트 처리에 대응). 인덱서 반영 전이면 400 — 재시도.
 */
export interface FinalizeConfirmResult {
  confirmed: boolean;
  point: number;
}

export async function postFinalizeConfirm(chainId: number, body: { tournamentId: number; txId: string }): Promise<FinalizeConfirmResult> {
  const res = await apiPost<ApiResponse<FinalizeConfirmResult>>(`/chains/${chainId}/midnight/finalize-confirm`, body);
  return res.data;
}
