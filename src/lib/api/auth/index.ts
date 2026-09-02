/**
 * Auth API 모듈 (Midnight(Lace) 서명 로그인 + JWT 쿠키 세션)
 *
 * 신규 인증 BE 의 `/auth/*` + `/me` 엔드포인트를 향한 타입드 래퍼.
 *
 * 응답 봉투(envelope) 규약:
 *   BE 의 전역 TransformInterceptor 가 모든 단일 응답을
 *   `{ success: true, data: <DTO>, meta: {...} }` 로 감싼다.
 *   따라서 여기서 `.data` 를 한 번 풀어(unwrap) 호출부엔 순수 DTO 만 노출한다.
 *   (user/tournaments 모듈은 envelope 째 반환하지만, auth 는 세션 훅이 곧바로
 *    소비하므로 unwrap 된 형태가 더 단순하다.)
 *
 * 쿠키/credentials: client.ts 의 apiGet/apiPost 가 v1 모드에서 자동으로
 *   `credentials: 'include'` 를 싣고, `/auth/*` 경로는 401-refresh 인터셉터를
 *   강제로 건너뛴다(루프 방지). 별도 옵션 불필요.
 */

import { apiGet, apiPost } from '../client';
import type { ApiResponse } from '../types';

/** `GET /auth/nonce` 의 data 페이로드 */
export interface NonceResponse {
  nonce: string;
  statement: string | null;
  expiresInMs: number;
}

/** `POST /auth/midnight/verify` 의 data 페이로드 */
export interface VerifyResponse {
  walletAddress: string;
  point: number;
}

/**
 * 로그인 1회성 nonce 발급.
 * `__Host-siwe_nonce` 쿠키도 함께 세팅된다(credentials 로 동행).
 */
export async function getNonce(): Promise<NonceResponse> {
  const res = await apiGet<ApiResponse<NonceResponse>>('/auth/nonce');
  return res.data;
}

/**
 * Midnight(Lace) 서명 로그인.
 *
 * `POST /auth/midnight/verify` body: `{ message, signedData, signature, verifyingKey }`
 *   - message      : buildMidnightAuthMessage() 결과 (domain/uri/nonce/address 포함)
 *   - signature    : Lace `signData(message, { encoding:'text', keyType:'unshielded' })`
 *   - verifyingKey : 같은 응답의 verifyingKey — BE 가 주소와 대응하는지 확인
 * 성공 시 HttpOnly 쿠키 세션이 발급된다.
 */
export async function verifyMidnight(
  message: string,
  signed: { data: string; signature: string; verifyingKey: string },
): Promise<VerifyResponse> {
  // signed.data = 지갑이 실제 서명한 바이트(hex, 프리픽스 + message) — BE 는 이걸로 서명을 검증하고
  // 끝부분이 message 와 같은지 확인한다.
  const res = await apiPost<ApiResponse<VerifyResponse>>('/auth/midnight/verify', {
    message,
    signedData: signed.data,
    signature: signed.signature,
    verifyingKey: signed.verifyingKey,
  });
  return res.data;
}

/**
 * 토큰 재발급(회전). 본문 없는 200 을 반환한다.
 * 빈 본문은 JSON 파싱 에러를 유발하므로 responseType:'text' 로 받는다.
 */
export async function refreshSession(): Promise<void> {
  await apiPost<string>('/auth/refresh', undefined, { responseType: 'text' });
}

/**
 * 로그아웃. 세션 종료 + 인증 쿠키 제거. 본문 없는 200.
 */
export async function logout(): Promise<void> {
  await apiPost<string>('/auth/logout', undefined, { responseType: 'text' });
}

/**
 * 세션 프로브 + 내 포인트 조회.
 * access-token 게이트 → 200 이면 인증됨, 401 이면 미인증.
 */
export async function getMe(): Promise<{ point: number }> {
  const res = await apiGet<ApiResponse<{ point: number }>>('/me');
  return res.data;
}
