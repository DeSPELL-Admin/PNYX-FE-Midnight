/**
 * Chain catalog — Midnight 단일 네트워크.
 *
 * wagmi `Chain` 모양 중 화면이 실제로 쓰는 필드(id, name, blockExplorers.default.url)만 유지한다.
 * chainId 는 합성값(MIDNIGHT_CHAIN_ID) — BE 라우트/로컬 저장 키와 공유한다.
 */
import { MIDNIGHT_CHAIN_ID, MIDNIGHT_EXPLORER_URLS, MIDNIGHT_NETWORK_ID } from './midnight/config';

export interface ChainInfo {
  id: number;
  name: string;
  network: string;
  blockExplorers?: { default: { name: string; url: string } };
}

const explorer = MIDNIGHT_EXPLORER_URLS[MIDNIGHT_NETWORK_ID];

export const MIDNIGHT_CHAIN: ChainInfo = {
  id: MIDNIGHT_CHAIN_ID,
  name: `Midnight ${MIDNIGHT_NETWORK_ID}`,
  network: MIDNIGHT_NETWORK_ID,
  ...(explorer ? { blockExplorers: { default: { name: 'Midnight Explorer', url: explorer } } } : {}),
};

export const CHAINS = [MIDNIGHT_CHAIN] as const;
export const CHAIN_IDS = CHAINS.map((c) => c.id);
