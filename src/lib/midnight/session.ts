/**
 * Midnight 세션(providers + contract join) 캐시 — 브라우저 전역 1개.
 *
 * finalize 흐름에서 가장 느린 준비 작업(WASM 로드, 지갑 설정 조회, verifier 키 전부 fetch, 인덱서
 * 상태 조회)을 게임이 시작될 때 미리 끝내 두고, 실제 제출 시점엔 재사용한다.
 *
 *   - 캐시 키는 (wallet 객체, address). Lace 가 재연결되어 ConnectedAPI 가 바뀌거나 주소가 바뀌면 새로 만든다.
 *   - 실패한 세션은 캐시에서 지워 다음 호출이 재시도한다.
 *   - 이 모듈은 midnight-js/WASM 을 끌어오므로 반드시 동적 import 로만 불러온다(서버 컴포넌트 금지).
 */

import type { ConnectedWallet } from './connector';
import {
  buildTournamentFinalizerProviders,
  prefetchFinalizeCircuit,
  type FinalizeBracketSize,
  type TFProviders,
} from './providers';
import { submitCallTxAsync } from '@midnight-ntwrk/midnight-js-contracts';
import { joinTournamentFinalizer, requireContractAddress, tournamentFinalizerCompiled, type JoinedTF } from './contract';
import { TF_PRIVATE_STATE_ID } from './providers';
import { getOrCreateUserSecret, newVoteSalt } from './userKeys';
import { mark, markError } from './finalizeTimeline';
// 생성 모듈을 직접 import 한다 — contract.ts 의 `export { TF }` 는 namespace 재export 라 webpack 이
// 정적 named import 를 해석하지 못해 "TF is not exported" 경고(런타임 undefined)를 낸다.
import * as TF from '~/midnight/contract/TournamentFinalizer/index.js';

export { TF_PRIVATE_STATE_ID };
/** 훅이 userPk 계산에 쓰는 순수 회로들 — namespace 대신 값으로 내보낸다(webpack 정적 해석용). */
export const pureCircuits = TF.pureCircuits;

export type MidnightSession = {
  providers: TFProviders;
  contract: JoinedTF;
};

let cached: { wallet: ConnectedWallet; address: string; promise: Promise<MidnightSession> } | null = null;

/**
 * providers 조립 + TournamentFinalizer join. 같은 (wallet, address) 면 진행 중이거나 완료된 Promise 를 돌려준다.
 * join 에 넘기는 private state 는 자리표시자다 — 실제 투표 직전에 훅이 (userSecret, 새 voteSalt) 로 덮어쓴다.
 */
export function getMidnightSession(wallet: ConnectedWallet, address: string): Promise<MidnightSession> {
  if (cached && cached.wallet === wallet && cached.address === address) return cached.promise;
  const promise = (async () => {
    mark('session:start');
    const providers = await buildTournamentFinalizerProviders(wallet);
    mark('session:providers-ready');
    const contract = await joinTournamentFinalizer(providers, {
      userSecret: getOrCreateUserSecret(address),
      voteSalt: newVoteSalt(),
    });
    mark('session:ready');
    return { providers, contract };
  })();
  const entry = { wallet, address, promise };
  cached = entry;
  promise.catch((e) => {
    markError('session:failed', e);
    if (cached === entry) cached = null;
  });
  return promise;
}

/** 게임 시작 시 호출 — 세션 준비 + 해당 라운드 회로의 prover 키 prefetch. 실패는 조용히 무시(제출 시 재시도). */
export function prewarmMidnight(wallet: ConnectedWallet, address: string, size: FinalizeBracketSize): void {
  // 효과(effect) 재실행마다 불리므로, 실제로 새 세션을 만드는 첫 호출만 기록한다.
  const fresh = !(cached && cached.wallet === wallet && cached.address === address);
  if (fresh) mark('prewarm:requested', { size });
  void getMidnightSession(wallet, address).catch((e) => console.warn('[midnight] prewarm failed:', e));
  // prover 키는 5~19MB — 데이터 절약 모드나 2G 회선에서는 미리 받지 않는다(증명 시점에 받는다).
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData || /2g/.test(conn?.effectiveType ?? '')) {
    mark('prefetch:skipped', { reason: conn?.saveData ? 'saveData' : conn?.effectiveType });
    return;
  }
  if (prefetchStarted.has(size)) return; // 같은 회로는 한 번만 기록(캐시는 provider 가 담당)
  prefetchStarted.add(size);
  mark('prefetch:start', { circuit: `finalizeTournament${size}` });
  prefetchFinalizeCircuit(size)
    .then((bytes) => mark('prefetch:ready', { circuit: `finalizeTournament${size}`, mb: Number((bytes / 1e6).toFixed(1)) }))
    .catch((e) => {
      prefetchStarted.delete(size);
      markError('prefetch:failed', e);
    });
}
const prefetchStarted = new Set<FinalizeBracketSize>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type FinalizeCircuitId = 'finalizeTournament16' | 'finalizeTournament32' | 'finalizeTournament64';

/**
 * finalize 회로를 증명·밸런싱·제출하고 **제출 직후** txId 를 돌려준다.
 * `contract.callTx[...]` 는 내부에서 `submitTx` → `watchForTxData` 로 인덱서 최종 반영(≈18s)까지 기다린 뒤에야
 * resolve 되는데, 그 대기는 BE finalize-confirm 폴링이 백그라운드에서 대신하므로 여기선 기다리지 않는다.
 * 증명은 이 호출 시점의 privateStateProvider 상태(userSecret, voteSalt)를 읽는다.
 */
export async function submitFinalizeAsync(providers: TFProviders, circuitId: FinalizeCircuitId, args: readonly unknown[]): Promise<string> {
  const { txId } = await submitCallTxAsync(providers as never, {
    compiledContract: tournamentFinalizerCompiled,
    circuitId,
    contractAddress: requireContractAddress(),
    privateStateId: TF_PRIVATE_STATE_ID,
    args,
  } as never);
  return String(txId);
}

export type GrantLeafInputs = {
  userPk: Uint8Array;
  tournamentId: number;
  point: bigint;
  deadline: bigint;
  bracket: number[];
};

/**
 * BE 가 넣은 eligibility leaf 가 인덱서에 반영될 때까지 기다린다.
 * BE 는 grant 를 비동기로 제출하고(노드 수락 직후 응답) 블록 포함·인덱싱은 여기서 기다린다 — 그 사이 증명을 시작하면
 * eligibilityPath witness 가 빈 경로를 돌려줘 회로가 `InvalidSigner` 로 좽는다.
 * 기다림이 끝나지 않으면 false 를 돌려준다. 호출자는 증명을 시작하지 않고 사용자에게 재시도를 요청한다
 * (InvalidSigner 로 확정 실패할 증명을 낭비하지 않기 위해). 기본 예산 2s × 30 ≈ 58s 는 BE 의 grant 생존 임계
 * (`MIDNIGHT_GRANT_LIVENESS_THRESHOLD_SECONDS`, 45s)보다 길어야 한다 — 타임아웃 뒤 재시도가 BE 의 재발급을 트리거한다.
 */
export async function waitForEligibilityLeaf(
  providers: TFProviders,
  input: GrantLeafInputs,
  { attempts = 30, intervalMs = 2_000 }: { attempts?: number; intervalMs?: number } = {},
): Promise<boolean> {
  const address = requireContractAddress();
  const hashers = { 16: TF.pureCircuits.bracketHash16, 32: TF.pureCircuits.bracketHash32, 64: TF.pureCircuits.bracketHash64 } as const;
  const hasher = hashers[input.bracket.length as FinalizeBracketSize];
  if (!hasher) return false;
  const bHash = hasher(input.bracket.map((x) => BigInt(x)));
  mark('leaf:wait');
  for (let i = 0; i < attempts; i++) {
    const st = await providers.publicDataProvider.queryContractState(address);
    if (st) {
      const ledger = TF.ledger(st.data);
      const leaf = TF.pureCircuits.eligibilityLeaf(ledger.domainTag, input.userPk, BigInt(input.tournamentId), input.point, input.deadline, bHash);
      if (ledger.eligibility.findPathForLeaf(leaf)) {
        mark('leaf:visible', { attempt: i + 1 });
        return true;
      }
    }
    if (i < attempts - 1) await sleep(intervalMs);
  }
  mark('leaf:timeout', { attempts });
  return false;
}
