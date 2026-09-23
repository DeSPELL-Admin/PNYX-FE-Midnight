/**
 * midnight-js providers 조립 (브라우저).
 *
 *   walletProvider / midnightProvider : Lace ConnectedAPI 위임 (balance → 지갑이 DUST 로 수수료 충당, submit)
 *   proofProvider                     : 지갑 proverServerUri(공용 서버 제외) > env(NEXT_PUBLIC_MIDNIGHT_PROOF_SERVER_URL) > 로컬 6300
 *   zkConfigProvider                  : /zk/<Name>/{keys,zkir} 를 fetch
 *   publicDataProvider                : 지갑 설정의 indexer
 *   privateStateProvider              : localStorage (userSecret 등은 브라우저와 선택된 proof server 만 본다)
 *
 * example-bboard/bboard-ui 의 BrowserDeployedBoardManager 패턴(Apache-2.0)을 따른다.
 */

import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  Transaction,
  type Binding,
  type FinalizedTransaction,
  type Proof,
  type SignatureEnabled,
  type TransactionId,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type { MidnightProviders, UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { MIDNIGHT_INDEXER_URL, MIDNIGHT_INDEXER_WS_URL, MIDNIGHT_NETWORK_ID, ZK_CONFIG_BASE_URL } from './config';
import { resolveProofServer, setProofServerInfo } from './proofServer';
import { classifyWalletError } from './dust';

// midnight-js 전역 네트워크 설정 — 주소 인코딩·tx 조립이 이걸 요구한다.
// BE(lib/sdk.ts)·CLI(scripts/lib/session.ts)는 각자 호출하지만 브라우저 번들은 여기가 유일한 진입점.
setNetworkId(MIDNIGHT_NETWORK_ID);
import { localStoragePrivateStateProvider } from './privateState';
import type { ConnectedWallet } from './connector';
import type { TournamentFinalizerPrivateState } from '~/midnight/contract/TournamentFinalizer.witnesses';
import { mark } from './finalizeTimeline';

export const TF_PRIVATE_STATE_ID = 'pnyxTournamentFinalizer' as const;
export type TFProviders = MidnightProviders<string, typeof TF_PRIVATE_STATE_ID, TournamentFinalizerPrivateState>;

/**
 * FetchZkConfigProvider 는 호출마다 다시 fetch 한다 — prover 키(5~19MB)는 회로별로 한 번만 받으면 되므로
 * 프로세스 수명 동안 메모이즈한다. 게임 중 `prefetchFinalizeCircuit()` 이 미리 채워 두면 증명 시점엔
 * 다운로드 없이 바로 proof server 로 올라간다. 실패한 fetch 는 캐시하지 않는다(다음 호출에서 재시도).
 */
class CachedFetchZkConfigProvider extends FetchZkConfigProvider<string> {
  private readonly memo = new Map<string, Promise<unknown>>();

  private cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.memo.get(key);
    if (hit) return hit as Promise<T>;
    const p = load();
    this.memo.set(key, p);
    p.catch(() => {
      if (this.memo.get(key) === p) this.memo.delete(key);
    });
    return p;
  }

  override getProverKey(circuitId: string) {
    return this.cached(`prover:${circuitId}`, () => super.getProverKey(circuitId));
  }
  override getVerifierKey(circuitId: string) {
    return this.cached(`verifier:${circuitId}`, () => super.getVerifierKey(circuitId));
  }
  override getZKIR(circuitId: string) {
    return this.cached(`zkir:${circuitId}`, () => super.getZKIR(circuitId));
  }
}

let zkConfigSingleton: CachedFetchZkConfigProvider | undefined;
/** 브라우저 전역 1개 — prefetch 와 실제 증명이 같은 캐시를 본다. client-only(window 필요). */
export function getTournamentFinalizerZkConfig(): CachedFetchZkConfigProvider {
  if (!zkConfigSingleton) {
    zkConfigSingleton = new CachedFetchZkConfigProvider(ZK_CONFIG_BASE_URL('TournamentFinalizer'), fetch.bind(window));
  }
  return zkConfigSingleton;
}

export type FinalizeBracketSize = 16 | 32 | 64;

/** finalizeTournament{N} 증명에 필요한 prover 키 + zkir 를 미리 받아 캐시에 올린다. prover 키 바이트 수를 돌려준다. */
export async function prefetchFinalizeCircuit(size: FinalizeBracketSize): Promise<number> {
  const zk = getTournamentFinalizerZkConfig();
  const id = `finalizeTournament${size}`;
  const [key] = await Promise.all([zk.getProverKey(id), zk.getZKIR(id)]);
  return (key as unknown as { length?: number }).length ?? 0;
}

/**
 * 확장 IPC 의 일시 오류인지 판별한다. 1AM 은 background 가 유휴로 내려간 뒤 첫 요청에서
 * "[1AM Content] Error forwarding message" 를 내고 dApp 에는 `{ code: 'InternalError', message: 'Request failed' }`
 * 를 돌려준다 — 같은 요청을 잠시 뒤 다시 보내면 통한다. 사용자 거절/잔액 부족 같은 확정 실패는 여기 걸리지 않는다.
 */
const isTransientWalletError = (e: unknown): boolean => classifyWalletError(e) === 'transient';

// 마지막으로 확장과 통신한 시각 — 재시도 로그에 유휴 시간을 남겨 "유휴 후 첫 호출" 가설을 검증한다.
let lastWalletCallAt = 0;

function walletAndMidnightProvider(wallet: ConnectedWallet) {
  const api: ConnectedAPI = wallet.api;
  return {
    getCoinPublicKey: () => wallet.coinPublicKey,
    getEncryptionPublicKey: () => wallet.encryptionPublicKey,
    async balanceTx(tx: UnboundTransaction, _ttl?: Date): Promise<FinalizedTransaction> {
      // 지갑이 DUST 로 수수료를 붙이고 서명·바인딩까지 마친 트랜잭션을 돌려준다.
      // 이 구간 = Lace 의 DUST 증명 + 사용자가 승인 팝업을 누르기까지의 시간.
      // 아직 아무것도 제출하지 않은 단계라 같은 tx 로 다시 요청해도 안전하다 — 일시 오류면 한 번 재시도한다.
      mark('wallet:balance:start');
      const hex = toHex(tx.serialize());
      let received: { tx: string };
      try {
        received = await api.balanceUnsealedTransaction(hex);
      } catch (e) {
        if (!isTransientWalletError(e)) throw e;
        const idleSec = lastWalletCallAt ? Math.round((Date.now() - lastWalletCallAt) / 1000) : undefined;
        mark('wallet:balance:retry', { idleSec, error: (e as Error)?.message });
        await new Promise((r) => setTimeout(r, 1_500));
        received = await api.balanceUnsealedTransaction(hex);
      }
      lastWalletCallAt = Date.now();
      mark('wallet:balance:done');
      return Transaction.deserialize<SignatureEnabled, Proof, Binding>('signature', 'proof', 'binding', fromHex(received.tx));
    },
    async submitTx(tx: FinalizedTransaction): Promise<TransactionId> {
      await api.submitTransaction(toHex(tx.serialize()));
      lastWalletCallAt = Date.now();
      mark('submit:done');
      return tx.identifiers()[0];
    },
  };
}

export async function buildTournamentFinalizerProviders(wallet: ConnectedWallet): Promise<TFProviders> {
  const config = await wallet.api.getConfiguration();
  lastWalletCallAt = Date.now();
  const zkConfigProvider = getTournamentFinalizerZkConfig();
  const proofServer = resolveProofServer(config.proverServerUri);
  setProofServerInfo(proofServer);
  mark('session:proof-server', { source: proofServer.source, url: proofServer.url });
  // 지갑 인덱서와 우리가 쓰는 인덱서가 다르면 남겨 둔다 — leaf 타임아웃 진단용.
  if (config.indexerUri !== MIDNIGHT_INDEXER_URL) {
    mark('session:indexer', { used: MIDNIGHT_INDEXER_URL, wallet: config.indexerUri });
  }
  const wp = walletAndMidnightProvider(wallet);
  const baseProofProvider = httpClientProofProvider(proofServer.url, zkConfigProvider);
  // proof server 왕복(키 업로드 + 서버 증명)만 따로 잰다 — 지갑 승인 시간과 분리하기 위해.
  const proofProvider: typeof baseProofProvider = {
    async proveTx(tx, config) {
      mark('prove:server:start');
      const proven = await baseProofProvider.proveTx(tx, config);
      mark('prove:server:done');
      return proven;
    },
  };
  return {
    privateStateProvider: localStoragePrivateStateProvider<typeof TF_PRIVATE_STATE_ID, TournamentFinalizerPrivateState>(),
    zkConfigProvider,
    proofProvider,
    // 컨트랙트 상태(grant leaf, 라이선스)는 네트워크 기본 인덱서(env 우선)로 읽는다 — 지갑이 알려주는
    // indexerUri 는 지갑마다/프로필마다 달라서(다른 인스턴스·버전·지연) 같은 체인인데도 우리 컨트랙트
    // 상태가 안 보이는 일이 있었다(leaf 는 온체인에 있는데 FE 만 30회 타임아웃). 공개 데이터라 프라이버시
    // 문제는 없고, 지갑 인덱서는 지갑 자신의 동기화에만 쓰이면 된다.
    publicDataProvider: indexerPublicDataProvider(MIDNIGHT_INDEXER_URL, MIDNIGHT_INDEXER_WS_URL),
    walletProvider: wp,
    midnightProvider: wp,
  };
}
