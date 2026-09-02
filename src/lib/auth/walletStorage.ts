/**
 * 지갑 로컬 스토리지 정리 유틸
 *
 * 로그아웃·서명 실패 등 "연결을 깨끗이 끊어야 하는" 지점에서 disconnect 직후 호출한다.
 * Midnight 에선 자동 재연결 플래그만 지운다. `userSecret` 은 **지우지 않는다** — 지우면 같은
 * 지갑이 새 신원으로 보이지만 온체인 nullifier 는 이미 소비돼 있어 재투표가 실패한다.
 */
export function clearWalletStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('pnyx:midnight:autoconnect');
  } catch (error) {
    console.warn('Failed to clear wallet storage:', error);
  }
}
