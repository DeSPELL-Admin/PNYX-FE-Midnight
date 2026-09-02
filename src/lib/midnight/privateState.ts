/**
 * localStorage 기반 PrivateStateProvider.
 *
 * midnight-js 의 level 기반 프로바이더는 Node 전용이라 브라우저용을 직접 둔다.
 * example-bboard 의 in-memory 구현(Apache-2.0)을 옮기고, 컨트랙트 주소별 상태를 localStorage 에
 * 영속화했다. 여기 저장되는 건 유저의 `userSecret`/`voteSalt`/escrow 등 **절대 서버로 보내면 안 되는**
 * 값이므로 서버 컴포넌트/API 로 흘러가지 않게 client 전용으로만 import 한다.
 */

import type { ContractAddress, SigningKey } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import type {
  ExportPrivateStatesOptions,
  ExportSigningKeysOptions,
  ImportPrivateStatesOptions,
  ImportPrivateStatesResult,
  ImportSigningKeysOptions,
  ImportSigningKeysResult,
  PrivateStateExport,
  PrivateStateId,
  PrivateStateProvider,
  SigningKeyExport,
} from '@midnight-ntwrk/midnight-js-types';

const STORAGE_PREFIX = 'pnyx:midnight:ps:';
const SIGNING_PREFIX = 'pnyx:midnight:sk:';

// Uint8Array 를 JSON 으로 왕복시키기 위한 태그 인코딩
const encode = (value: unknown): string =>
  JSON.stringify(value, (_k, v) => {
    if (v instanceof Uint8Array) return { __u8: Array.from(v) };
    if (typeof v === 'bigint') return { __big: v.toString() };
    return v;
  });
const decode = <T>(value: string): T =>
  JSON.parse(value, (_k, v) => {
    if (v && typeof v === 'object') {
      if (Array.isArray((v as { __u8?: number[] }).__u8)) return new Uint8Array((v as { __u8: number[] }).__u8);
      if (typeof (v as { __big?: string }).__big === 'string') return BigInt((v as { __big: string }).__big);
    }
    return v;
  }) as T;

const canStore = () => typeof window !== 'undefined' && !!window.localStorage;

export const localStoragePrivateStateProvider = <PSI extends PrivateStateId, PS = unknown>(): PrivateStateProvider<PSI, PS> => {
  let contractAddress: ContractAddress | null = null;

  const requireContractAddress = (): ContractAddress => {
    if (contractAddress === null) throw new Error('Contract address not set. Call setContractAddress() first.');
    return contractAddress;
  };
  const stateKey = (address: ContractAddress, id: PSI) => `${STORAGE_PREFIX}${address}:${id}`;
  const signingKeyKey = (address: ContractAddress) => `${SIGNING_PREFIX}${address}`;

  const listStateIds = (address: ContractAddress): PSI[] => {
    if (!canStore()) return [];
    const prefix = `${STORAGE_PREFIX}${address}:`;
    const out: PSI[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) out.push(k.slice(prefix.length) as PSI);
    }
    return out;
  };

  return {
    setContractAddress(address) {
      contractAddress = address;
    },
    set(id, state) {
      if (canStore()) localStorage.setItem(stateKey(requireContractAddress(), id), encode(state));
      return Promise.resolve();
    },
    get(id) {
      const raw = canStore() ? localStorage.getItem(stateKey(requireContractAddress(), id)) : null;
      return Promise.resolve(raw === null ? null : decode<PS>(raw));
    },
    remove(id) {
      if (canStore()) localStorage.removeItem(stateKey(requireContractAddress(), id));
      return Promise.resolve();
    },
    clear() {
      const address = requireContractAddress();
      listStateIds(address).forEach((id) => localStorage.removeItem(stateKey(address, id)));
      return Promise.resolve();
    },
    setSigningKey(address, signingKey) {
      if (canStore()) localStorage.setItem(signingKeyKey(address), signingKey);
      return Promise.resolve();
    },
    getSigningKey(address) {
      return Promise.resolve((canStore() ? localStorage.getItem(signingKeyKey(address)) : null) as SigningKey | null);
    },
    removeSigningKey(address) {
      if (canStore()) localStorage.removeItem(signingKeyKey(address));
      return Promise.resolve();
    },
    clearSigningKeys() {
      if (!canStore()) return Promise.resolve();
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(SIGNING_PREFIX)) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
      return Promise.resolve();
    },
    exportPrivateStates(_options?: ExportPrivateStatesOptions): Promise<PrivateStateExport> {
      const address = requireContractAddress();
      const states = Object.fromEntries(
        listStateIds(address).map((id) => [id, localStorage.getItem(stateKey(address, id)) ?? '']),
      );
      return Promise.resolve({
        format: 'midnight-private-state-export',
        encryptedPayload: JSON.stringify({ contractAddress: address, states }),
        salt: 'pnyx-localstorage-private-state-provider',
      });
    },
    importPrivateStates(exportData: PrivateStateExport, options?: ImportPrivateStatesOptions): Promise<ImportPrivateStatesResult> {
      const address = requireContractAddress();
      const conflictStrategy = options?.conflictStrategy ?? 'error';
      const payload = JSON.parse(exportData.encryptedPayload) as { states?: Record<string, string> };
      let imported = 0, skipped = 0, overwritten = 0;
      for (const [rawId, serialized] of Object.entries(payload.states ?? {})) {
        const id = rawId as PSI;
        const exists = localStorage.getItem(stateKey(address, id)) !== null;
        if (exists) {
          if (conflictStrategy === 'skip') { skipped += 1; continue; }
          if (conflictStrategy === 'error') return Promise.reject(new Error(`Private state conflict for '${id}'`));
          overwritten += 1;
        } else imported += 1;
        localStorage.setItem(stateKey(address, id), serialized);
      }
      return Promise.resolve({ imported, skipped, overwritten });
    },
    exportSigningKeys(_options?: ExportSigningKeysOptions): Promise<SigningKeyExport> {
      const keys: Record<string, string> = {};
      if (canStore()) {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith(SIGNING_PREFIX)) keys[k.slice(SIGNING_PREFIX.length)] = localStorage.getItem(k) ?? '';
        }
      }
      return Promise.resolve({
        format: 'midnight-signing-key-export',
        encryptedPayload: JSON.stringify({ keys }),
        salt: 'pnyx-localstorage-signing-key-provider',
      });
    },
    importSigningKeys(exportData: SigningKeyExport, options?: ImportSigningKeysOptions): Promise<ImportSigningKeysResult> {
      const conflictStrategy = options?.conflictStrategy ?? 'error';
      const payload = JSON.parse(exportData.encryptedPayload) as { keys?: Record<string, string> };
      let imported = 0, skipped = 0, overwritten = 0;
      for (const [address, key] of Object.entries(payload.keys ?? {})) {
        const exists = localStorage.getItem(signingKeyKey(address)) !== null;
        if (exists) {
          if (conflictStrategy === 'skip') { skipped += 1; continue; }
          if (conflictStrategy === 'error') return Promise.reject(new Error(`Signing key conflict for '${address}'`));
          overwritten += 1;
        } else imported += 1;
        localStorage.setItem(signingKeyKey(address), key);
      }
      return Promise.resolve({ imported, skipped, overwritten });
    },
  };
};
