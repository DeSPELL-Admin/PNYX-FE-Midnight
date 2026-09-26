/**
 * 송금은 나갔는데 BE `pay` 기록에 실패한 주문의 txId 를 세션 동안 보관한다.
 * useBuyDataset 이 저장하고 ManualPayCard 가 프리필로 꺼내 쓴다 — 사용자가 같은 주문에 두 번 송금하지 않게.
 * 배럴 재수출 금지(hooks/market/index.ts 에서 export 하지 않는다).
 */

const KEY_PREFIX = 'pnyx:market:pendingTx:';

export function rememberPendingPaymentTx(orderId: string, txId: string): void {
  try {
    sessionStorage.setItem(KEY_PREFIX + orderId, txId);
  } catch {
    /* storage 미허용 환경 — 프리필만 포기 */
  }
}

export function takePendingPaymentTx(orderId: string): string | undefined {
  try {
    const txId = sessionStorage.getItem(KEY_PREFIX + orderId) ?? undefined;
    if (txId) sessionStorage.removeItem(KEY_PREFIX + orderId);
    return txId;
  } catch {
    return undefined;
  }
}
