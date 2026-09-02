// 지갑 전환 중 BE 세션 teardown(logout) 진행 플래그.
// authSessionKey 를 쓰는 모든 React Query 구독자가 이 플래그를 honor 해 프로브를 멈춘다.
let pendingReauth = false;
const listeners = new Set<() => void>();

export function getPendingReauth(): boolean {
  return pendingReauth;
}

export function setPendingReauth(value: boolean): void {
  if (pendingReauth === value) return;
  pendingReauth = value;
  listeners.forEach((l) => l());
}

export function subscribePendingReauth(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
