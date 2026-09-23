/**
 * DUST(수수료) 사전 확인 + 지갑 에러 분류. midnight-js 의존성 없음 — 훅/UI 에서 바로 import 한다.
 *
 * DUST 는 사지 않고 보유한 NIGHT 에서 시간이 지나며 생성된다. 새 지갑은 NIGHT 를 등록한 뒤에도 잔액이
 * 차기까지 기다려야 하므로, 증명(~30s)을 다 만들고 balance 단계에서 "could not balance dust" 로
 * 실패하기 전에 미리 확인해 Submit 을 막고 안내한다.
 */

import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

export type DustState =
  /** 지갑이 getDustBalance 를 제공하지 않음 — 막지 않고 진행, 실패하면 에러 분류로 안내 */
  | 'unknown'
  /** NIGHT 미등록(cap = 0) — DUST 가 생성될 원천이 없다 */
  | 'no_night'
  /** NIGHT 는 있지만 아직 DUST 가 0 — 생성 대기 */
  | 'generating'
  | 'ready';

export interface DustStatus {
  state: DustState;
  balance: bigint;
  cap: bigint;
  /** state === 'unknown' 인 이유 — 로그/진단용 */
  reason?: string;
}

/**
 * 커넥터 규격은 bigint 지만 확장 브리지가 JSON 으로 직렬화하면 number/string(10진·0x)으로 올 수 있다.
 * 숫자로 읽히면 전부 받아들이고, 정말 해석 불가일 때만 undefined.
 */
function toBigInt(v: unknown): bigint | undefined {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.trunc(v));
  if (typeof v === 'string' && /^(0x[0-9a-f]+|\d+)$/i.test(v.trim())) return BigInt(v.trim());
  return undefined;
}

/** 지갑에서 DUST 잔액/상한을 읽어 상태로 요약한다. 조회 자체가 실패하면 'unknown'(진행은 허용). */
export async function readDustStatus(api: ConnectedAPI): Promise<DustStatus> {
  const unknown = (reason: string): DustStatus => {
    console.warn(`[dust] pre-check unavailable — proceeding without it: ${reason}`);
    return { state: 'unknown', balance: 0n, cap: 0n, reason };
  };
  if (typeof api.getDustBalance !== 'function') return unknown('wallet has no getDustBalance');
  let raw: unknown;
  try {
    raw = await api.getDustBalance();
  } catch (e) {
    return unknown(`getDustBalance threw: ${(e as Error)?.message ?? String(e)}`);
  }
  const r = (raw && typeof raw === 'object' ? raw : {}) as { balance?: unknown; cap?: unknown };
  const balance = toBigInt(r.balance);
  const cap = toBigInt(r.cap);
  // 규격 밖의 응답을 'no_night' 로 오판해 Submit 을 영구히 막지 않는다 — 원본 모양을 남겨 진단한다.
  if (balance === undefined || cap === undefined) {
    return unknown(`unexpected getDustBalance shape: ${safeStringify(raw)}`);
  }
  if (balance > 0n) return { state: 'ready', balance, cap };
  return { state: cap > 0n ? 'generating' : 'no_night', balance, cap };
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? `${x}n` : x)).slice(0, 200);
  } catch {
    return String(v);
  }
}

export type WalletErrorKind =
  /** 수수료 DUST 부족 — 지갑 balance 단계 "Insufficient Funds: could not balance dust" */
  | 'dust_insufficient'
  /** 확장 세션 만료/끊김 — 재연결 후 재시도 */
  | 'session_expired'
  /** 사용자가 승인 팝업에서 거절 */
  | 'rejected'
  /** 확장 내부 일시 오류 — 같은 요청을 그대로 재시도해도 안전 */
  | 'transient'
  /** 지갑이 요청 자체를 거부(형식 오류 등) — 재시도해도 같다 */
  | 'invalid_request'
  | 'unknown';

interface ErrorLike { code?: unknown; message?: unknown; reason?: unknown }

/** DApp connector 에러(code)와 메시지 패턴으로 분류한다. 메시지가 비고 code 만 있는 경우도 커버. */
export function classifyWalletError(e: unknown): WalletErrorKind {
  const err = (e && typeof e === 'object' ? e : {}) as ErrorLike;
  const text = [err.message, err.reason].filter((s): s is string => typeof s === 'string').join(' ');
  if (/could not balance dust|insufficient (funds|dust)/i.test(text)) return 'dust_insufficient';
  if (err.code === 'Rejected' || err.code === 'PermissionRejected') return 'rejected';
  if (err.code === 'Disconnected' || /connection expired|not connected/i.test(text)) return 'session_expired';
  if (err.code === 'InternalError' || /request failed/i.test(text)) return 'transient';
  if (err.code === 'InvalidRequest') return 'invalid_request';
  return 'unknown';
}
