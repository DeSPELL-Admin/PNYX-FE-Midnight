/**
 * Lace(Midnight) DApp connector 탐색/연결.
 *
 * 지갑은 `window.midnight.<uuid>` 아래에 InitialAPI 를 주입하므로 고정 키 대신 열거해서
 * apiVersion 이 호환되는 첫 지갑을 고른다(공식 가이드 권장). `connect(networkId)` 는 사용자
 * 승인 팝업을 띄우고 ConnectedAPI 를 돌려준다.
 */

import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import semver from 'semver';
import { COMPATIBLE_CONNECTOR_API_VERSION, MIDNIGHT_NETWORK_ID } from './config';

// `window.midnight` 타입은 @midnight-ntwrk/dapp-connector-api 가 전역 선언한다.

export class WalletNotFoundError extends Error {
  constructor() {
    super('Midnight Lace wallet not found. Is the extension installed?');
    this.name = 'WalletNotFoundError';
  }
}

export function findWallet(): InitialAPI | undefined {
  if (typeof window === 'undefined' || !window.midnight) return undefined;
  return Object.values(window.midnight).find(
    (w): w is InitialAPI =>
      !!w && typeof w === 'object' && 'apiVersion' in w && semver.satisfies(w.apiVersion, COMPATIBLE_CONNECTOR_API_VERSION),
  );
}

/** 확장 주입은 페이지 로드 직후 늦게 올 수 있어 잠시 폴링한다. */
export async function waitForWallet(timeoutMs = 1_500): Promise<InitialAPI> {
  const start = Date.now();
  for (;;) {
    const w = findWallet();
    if (w) return w;
    if (Date.now() - start > timeoutMs) throw new WalletNotFoundError();
    await new Promise((r) => setTimeout(r, 100));
  }
}

export interface ConnectedWallet {
  api: ConnectedAPI;
  /** 트랜잭션 제출/서명 주체 — `msg.sender` 대응. bech32m(mn_addr_…) */
  unshieldedAddress: string;
  /** 회로의 `ownPublicKey()` 와 대응하는 shielded coin public key (hex) */
  coinPublicKey: string;
  encryptionPublicKey: string;
  walletName: string;
}

export async function connectWallet(): Promise<ConnectedWallet> {
  const initial = await waitForWallet();
  const api = await initial.connect(MIDNIGHT_NETWORK_ID);
  const status = await api.getConnectionStatus();
  if (status.status !== 'connected') throw new Error('Wallet refused the connection');
  if (status.networkId !== MIDNIGHT_NETWORK_ID) {
    throw new Error(`Wallet is on "${status.networkId}" — switch Lace to "${MIDNIGHT_NETWORK_ID}"`);
  }
  const [{ unshieldedAddress }, shielded] = await Promise.all([api.getUnshieldedAddress(), api.getShieldedAddresses()]);
  return {
    api,
    unshieldedAddress,
    coinPublicKey: shielded.shieldedCoinPublicKey,
    encryptionPublicKey: shielded.shieldedEncryptionPublicKey,
    walletName: initial.name,
  };
}

/**
 * 메시지 서명. Lace 는 unshielded 키로 서명하며 `{ data, signature, verifyingKey }` 를
 * 돌려준다 — BE 는 verifyingKey 가 주소와 대응하는지 + 서명을 검증한다.
 */
export async function signMessage(api: ConnectedAPI, message: string) {
  return api.signData(message, { encoding: 'text', keyType: 'unshielded' });
}
