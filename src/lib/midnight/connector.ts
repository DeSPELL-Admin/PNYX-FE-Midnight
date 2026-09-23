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

/**
 * 커넥터 v4 를 구현했다고 해서 모든 메서드를 제공하는 건 아니다(지갑마다 지원 범위가 다르다).
 * 연결 직후 검사해 안 되는 지갑은 여기서 막는다 — 로그인(signData)이나 투표 제출(balance)
 * 단계까지 가서 뒤늦게 실패하지 않도록.
 */
export const REQUIRED_WALLET_METHODS = [
  'getConnectionStatus',
  'getConfiguration',
  'getUnshieldedAddress',
  'getShieldedAddresses',
  'signData',
  'balanceUnsealedTransaction',
  'submitTransaction',
] as const satisfies readonly (keyof ConnectedAPI)[];

/** 없어도 연결은 허용하되 해당 기능만 비활성화하는 메서드 */
export const OPTIONAL_WALLET_METHODS = ['makeTransfer'] as const satisfies readonly (keyof ConnectedAPI)[];

export interface WalletCapabilities {
  /** `makeTransfer` — 마켓 in-page 결제. false 면 수동 결제(ManualPayCard)로 바로 간다. */
  transfer: boolean;
}

export class WalletUnsupportedError extends Error {
  readonly walletName: string;
  readonly missing: readonly string[];
  constructor(walletName: string, missing: readonly string[]) {
    super(`${walletName} does not support the wallet features PNYX needs (${missing.join(', ')})`);
    this.name = 'WalletUnsupportedError';
    this.walletName = walletName;
    this.missing = missing;
  }
}

/** 필수 메서드가 하나라도 빠지면 throw, 아니면 선택 기능 지원 여부를 돌려준다. */
export function probeCapabilities(api: ConnectedAPI, walletName: string): WalletCapabilities {
  const has = (m: string) => typeof (api as unknown as Record<string, unknown>)[m] === 'function';
  const missing = REQUIRED_WALLET_METHODS.filter((m) => !has(m));
  if (missing.length > 0) throw new WalletUnsupportedError(walletName, missing);
  return { transfer: has('makeTransfer') };
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
  /** 선택 기능 지원 여부 — 필수 기능은 연결 시점에 이미 검증됐다 */
  caps: WalletCapabilities;
}

/** `rdns` 생략 시 감지된 첫 지갑에 연결한다(지갑이 하나뿐일 때). */
export async function connectWallet(rdns?: string): Promise<ConnectedWallet> {
  const initial = await waitForWallet(rdns);
  const api = await initial.connect(MIDNIGHT_NETWORK_ID);
  // 아래에서 바로 쓰는 getConnectionStatus 포함, 필수 메서드가 없으면 여기서 끝낸다.
  const caps = probeCapabilities(api, initial.name);
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
    caps,
  };
}

/**
 * 메시지 서명. 지갑은 unshielded 키로 서명하며 `{ data, signature, verifyingKey }` 를
 * 돌려준다 — BE 는 verifyingKey 가 주소와 대응하는지 + 서명을 검증한다.
 */
export async function signMessage(api: ConnectedAPI, message: string) {
  return api.signData(message, { encoding: 'text', keyType: 'unshielded' });
}
