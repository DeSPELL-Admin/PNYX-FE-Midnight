/**
 * midnight-js providers 조립 (브라우저).
 *
 *   walletProvider / midnightProvider : Lace ConnectedAPI 위임 (balance → 지갑이 DUST 로 수수료 충당, submit)
 *   proofProvider                     : env(NEXT_PUBLIC_MIDNIGHT_PROOF_SERVER_URL) > 지갑 proverServerUri > 로컬 6300
 *   zkConfigProvider                  : /zk/<Name>/{keys,zkir} 를 fetch
 *   publicDataProvider                : 지갑 설정의 indexer
 *   privateStateProvider              : localStorage (userSecret 등이 브라우저를 떠나지 않는다)
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
import { FALLBACK_PROOF_SERVER_URL, MIDNIGHT_NETWORK_ID, ZK_CONFIG_BASE_URL } from './config';

// midnight-js 전역 네트워크 설정 — 주소 인코딩·tx 조립이 이걸 요구한다.
// BE(lib/sdk.ts)·CLI(scripts/lib/session.ts)는 각자 호출하지만 브라우저 번들은 여기가 유일한 진입점.
setNetworkId(MIDNIGHT_NETWORK_ID);
import { localStoragePrivateStateProvider } from './privateState';
import type { ConnectedWallet } from './connector';
import type { TournamentFinalizerPrivateState } from '~/midnight/contract/TournamentFinalizer.witnesses';

export const TF_PRIVATE_STATE_ID = 'pnyxTournamentFinalizer' as const;
export type TFProviders = MidnightProviders<string, typeof TF_PRIVATE_STATE_ID, TournamentFinalizerPrivateState>;

function walletAndMidnightProvider(wallet: ConnectedWallet) {
  const api: ConnectedAPI = wallet.api;
  return {
    getCoinPublicKey: () => wallet.coinPublicKey,
    getEncryptionPublicKey: () => wallet.encryptionPublicKey,
    async balanceTx(tx: UnboundTransaction, _ttl?: Date): Promise<FinalizedTransaction> {
      // 지갑이 DUST 로 수수료를 붙이고 서명·바인딩까지 마친 트랜잭션을 돌려준다.
      const received = await api.balanceUnsealedTransaction(toHex(tx.serialize()));
      return Transaction.deserialize<SignatureEnabled, Proof, Binding>('signature', 'proof', 'binding', fromHex(received.tx));
    },
    async submitTx(tx: FinalizedTransaction): Promise<TransactionId> {
      await api.submitTransaction(toHex(tx.serialize()));
      return tx.identifiers()[0];
    },
  };
}

export async function buildTournamentFinalizerProviders(wallet: ConnectedWallet): Promise<TFProviders> {
  const config = await wallet.api.getConfiguration();
  const zkConfigProvider = new FetchZkConfigProvider<string>(ZK_CONFIG_BASE_URL('TournamentFinalizer'), fetch.bind(window));
  // env 로 지정된 proof server 가 있으면 지갑 설정보다 우선한다 — Lace 기본값(공용
  // proof-server.preprod.midnight.network)은 프루빙 요청을 403 으로 거부하므로 로컬 서버가 필요.
  const proverUri = process.env.NEXT_PUBLIC_MIDNIGHT_PROOF_SERVER_URL
    ? FALLBACK_PROOF_SERVER_URL
    : (config.proverServerUri || FALLBACK_PROOF_SERVER_URL);
  const wp = walletAndMidnightProvider(wallet);
  return {
    privateStateProvider: localStoragePrivateStateProvider<typeof TF_PRIVATE_STATE_ID, TournamentFinalizerPrivateState>(),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(proverUri, zkConfigProvider),
    publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
    walletProvider: wp,
    midnightProvider: wp,
  };
}
