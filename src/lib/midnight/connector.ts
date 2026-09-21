/**
 * Midnight DApp connector(v4) 탐색/연결 — Lace, 1AM 등 표준 커넥터를 구현한 모든 지갑.
 *
 * 지갑은 `window.midnight.<uuid>` 아래에 InitialAPI 를 주입하므로 고정 키 대신 열거해서
 * apiVersion 이 호환되는 지갑 목록을 만든다(공식 가이드 권장). 사용자가 고른 지갑의
 * `connect(networkId)` 가 승인 팝업을 띄우고 ConnectedAPI 를 돌려준다.
 */

import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import semver from 'semver';
import { COMPATIBLE_CONNECTOR_API_VERSION, MIDNIGHT_NETWORK_ID } from './config';

// `window.midnight` 타입은 @midnight-ntwrk/dapp-connector-api 가 전역 선언한다.

export class WalletNotFoundError extends Error {
  constructor(rdns?: string) {
    super(rdns ? `Midnight wallet "${rdns}" not found. Is the extension installed?` : 'No Midnight wallet found. Is Lace or 1AM installed?');
    this.name = 'WalletNotFoundError';
  }
}

/** 설치된 호환 지갑 목록. 같은 지갑이 여러 API 버전을 주입할 수 있어 rdns 로 중복 제거한다. */
export function listWallets(): InitialAPI[] {
  if (typeof window === 'undefined' || !window.midnight) return [];
  const byRdns = new Map<string, InitialAPI>();
  for (const w of Object.values(window.midnight)) {
    if (!w || typeof w !== 'object' || !('apiVersion' in w)) continue;
    if (!semver.satisfies(w.apiVersion, COMPATIBLE_CONNECTOR_API_VERSION)) continue;
    if (!byRdns.has(w.rdns)) byRdns.set(w.rdns, w);
  }
  return [...byRdns.values()];
}

/** 확장 주입은 페이지 로드 직후 늦게 올 수 있어 잠시 폴링한다. rdns 를 주면 그 지갑을 기다린다. */
export async function waitForWallet(rdns?: string, timeoutMs = 1_500): Promise<InitialAPI> {
  const start = Date.now();
  for (;;) {
    const wallets = listWallets();
    const w = rdns ? wallets.find((x) => x.rdns === rdns) : wallets[0];
    if (w) return w;
    if (Date.now() - start > timeoutMs) throw new WalletNotFoundError(rdns);
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
  /** 지갑 식별자(reverse DNS) — 자동 재연결 시 같은 지갑을 고르는 데 쓴다 */
  walletRdns: string;
}

/** `rdns` 생략 시 감지된 첫 지갑에 연결한다(지갑이 하나뿐일 때). */
export async function connectWallet(rdns?: string): Promise<ConnectedWallet> {
  const initial = await waitForWallet(rdns);
  const api = await initial.connect(MIDNIGHT_NETWORK_ID);
  const status = await api.getConnectionStatus();
  if (status.status !== 'connected') throw new Error('Wallet refused the connection');
  if (status.networkId !== MIDNIGHT_NETWORK_ID) {
    throw new Error(`Wallet is on "${status.networkId}" — switch ${initial.name} to "${MIDNIGHT_NETWORK_ID}"`);
  }
  const [{ unshieldedAddress }, shielded] = await Promise.all([api.getUnshieldedAddress(), api.getShieldedAddresses()]);
  return {
    api,
    unshieldedAddress,
    coinPublicKey: shielded.shieldedCoinPublicKey,
    encryptionPublicKey: shielded.shieldedEncryptionPublicKey,
    walletName: initial.name,
    walletRdns: initial.rdns,
  };
}

/**
 * 메시지 서명. 지갑은 unshielded 키로 서명하며 `{ data, signature, verifyingKey }` 를
 * 돌려준다 — BE 는 verifyingKey 가 주소와 대응하는지 + 서명을 검증한다.
 */
export async function signMessage(api: ConnectedAPI, message: string) {
  return api.signData(message, { encoding: 'text', keyType: 'unshielded' });
}
