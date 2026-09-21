/**
 * 마켓 결제 — Lace `makeTransfer` 로 오퍼레이터(BE `payTo`)에게 tNight(BE 가 지정한 `tokenTypeRaw`)를
 * 직접 송금한다. useFinalizeTournament 의 컨트랙트 호출과 달리 컨트랙트 교신이 아닌 순수 지갑 송금이라
 * providers.ts 의 무거운 프로바이더 조립이 필요 없다 — `ConnectedAPI` 의 makeTransfer/submitTransaction
 * 만 쓴다. 값 import 는 전부 함수 내부 동적 로드(WASM/compact-runtime 를 태우므로) — 파일 상단은 타입만.
 */

import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { Binding, Proof, SignatureEnabled } from '@midnight-ntwrk/midnight-js-protocol/ledger';

/**
 * `recipient` 에게 `valueUnits` 만큼 `tokenTypeRaw` 를 송금하고 tx id 를 돌려준다.
 * `makeTransfer` 는 지갑이 이미 잔액을 채우고 서명·바인딩까지 마친 트랜잭션을 돌려주므로
 * (providers.ts 의 `balanceUnsealedTransaction` 과 달리) 곧장 `submitTransaction` 한다.
 * txId 는 providers.ts:50 `submitTx` 와 동일하게 직렬화된 tx 를 역직렬화해 `identifiers()[0]` 로 얻는다.
 */
export async function payOperator(
  api: ConnectedAPI,
  recipient: string,
  tokenTypeRaw: string,
  valueUnits: bigint,
): Promise<string> {
  const [{ fromHex }, { Transaction }] = await Promise.all([
    import('@midnight-ntwrk/midnight-js-protocol/compact-runtime'),
    import('@midnight-ntwrk/midnight-js-protocol/ledger'),
  ]);

  await api.hintUsage?.(['makeTransfer', 'submitTransaction']);

  // 진단: Lace 가 보는 잔액 키(TokenType 표현)와 BE 가 준 tokenTypeRaw 가 일치하는지 확인
  try {
    const balances = await api.getUnshieldedBalances?.();
    console.log('[payOperator] balances keys:', balances ? Object.keys(balances) : '(none)', '| requested type:', tokenTypeRaw, '| value:', valueUnits.toString(), '| recipient:', recipient.slice(0, 28));
  } catch (e) {
    console.warn('[payOperator] getUnshieldedBalances failed:', e);
  }

  const describe = (e: unknown): string => {
    const err = e as Error & { cause?: unknown };
    const parts = [String(err?.message ?? e)];
    if (err?.cause) parts.push(`cause: ${String((err.cause as Error)?.message ?? err.cause)}`);
    if (err?.stack) parts.push(err.stack.split('\n').slice(0, 4).join(' | '));
    return parts.join(' — ');
  };

  const output = { kind: 'unshielded' as const, type: tokenTypeRaw, value: valueUnits, recipient };
  let tx: string;
  try {
    // Lace 2.2.3 버그 우회: 핸들러가 세 번째 자리에서 호출 컨텍스트(r.sender)를 읽으므로
    // options 를 생략하면 자리가 밀려 undefined.sender 로 죽는다 — 반드시 options 를 명시한다.
    ({ tx } = await api.makeTransfer([output], { payFees: true }));
  } catch (e) {
    console.error('[payOperator] makeTransfer failed:', describe(e), e);
    // Lace 의 makeTransfer 가 아직 불안정한 버전이 있어(sender undefined) 같은 용도의
    // makeIntent(입력은 지갑이 채움) 로 폴백한다.
    try {
      ({ tx } = await api.makeIntent([], [output], { intentId: 'random', payFees: true }));
      console.log('[payOperator] makeIntent fallback succeeded');
    } catch (e2) {
      console.error('[payOperator] makeIntent fallback failed:', describe(e2), e2);
      throw new Error(`wallet transfer failed — makeTransfer: ${describe(e)} / makeIntent: ${describe(e2)}`);
    }
  }
  // txId 는 반드시 submit *전에* 뽑는다 — 지갑이 돌려준 직렬화가 우리 ledger 버전과 안 맞아
  // deserialize 가 던지면, 송금은 이미 나갔는데 txId 만 잃어 주문이 CREATED(수동 결제)로 남는
  // 최악의 상태가 된다. 여기서 실패하면 돈이 나가기 전에 멈춘다.
  const txId = Transaction.deserialize<SignatureEnabled, Proof, Binding>('signature', 'proof', 'binding', fromHex(tx)).identifiers()[0];
  if (!txId) throw new Error('wallet transaction has no identifier');

  await api.submitTransaction(tx);
  return txId;
}
