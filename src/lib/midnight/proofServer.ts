/**
 * proof server 선택 — midnight-js 의존성이 없어 UI(Result 배지)에서 바로 import 할 수 있다.
 *
 * 회로 증명은 witness(userSecret·voteSalt·bracket)를 proof server 에 보내 만든다. 즉 어느 서버를
 * 고르느냐가 곧 "누가 내 비공개 입력을 보는가"다. 사용자가 지갑에 직접 넣은 서버(자기 통제)가
 * 최우선이고, 없을 때만 PNYX 호스팅(env, 데모) → 로컬 127.0.0.1 로 내려간다.
 */

import { ENV_PROOF_SERVER_URL, LOCAL_PROOF_SERVER_URL, isPublicMidnightProofServer } from './config';

/** 'wallet' = 사용자 자신의 지갑 설정, 'env' = PNYX 호스팅(데모), 'local' = 127.0.0.1:6300 */
export type ProofServerSource = 'wallet' | 'env' | 'local';
export interface ProofServerInfo { url: string; source: ProofServerSource }

/** Lace 기본값인 Midnight 공용 서버는 dApp 프루빙을 403 으로 거부하므로 "설정 없음"으로 본다. */
export function resolveProofServer(walletProverServerUri: string | undefined): ProofServerInfo {
  if (walletProverServerUri && !isPublicMidnightProofServer(walletProverServerUri)) {
    return { url: walletProverServerUri, source: 'wallet' };
  }
  if (ENV_PROOF_SERVER_URL) return { url: ENV_PROOF_SERVER_URL, source: 'env' };
  return { url: LOCAL_PROOF_SERVER_URL, source: 'local' };
}

/** 배지 표시용 호스트(:포트). 파싱이 안 되면 원문을 그대로 보여준다. */
export function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

// 마지막으로 선택된 proof server — Result 화면 배지가 useSyncExternalStore 로 읽는다.
// providers 는 prewarm(게임 시작) 시점에 조립되므로 Submit 화면에선 이미 채워져 있다.
let current: ProofServerInfo | undefined;
const listeners = new Set<() => void>();

export function getProofServerInfo(): ProofServerInfo | undefined { return current; }
/** SSR 스냅샷 — 서버에선 providers 가 조립되지 않으므로 항상 비어 있다. */
export const getProofServerInfoServerSnapshot = (): ProofServerInfo | undefined => undefined;
export function subscribeProofServerInfo(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function setProofServerInfo(info: ProofServerInfo | undefined): void {
  if (current?.url === info?.url && current?.source === info?.source) return;
  current = info;
  listeners.forEach((l) => l());
}
/** 지갑 연결 해제/교체 시 — 이전 지갑의 서버를 배지에 남기면 "누가 내 비밀값을 보는가"를 잘못 알린다. */
export function clearProofServerInfo(): void { setProofServerInfo(undefined); }
