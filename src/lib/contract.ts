/**
 * 컨트랙트 주소 관리 (Midnight).
 * 기존 per-chain 맵 대신 네트워크 하나 + env 하나. 주소는 64-hex contract address.
 */
import { MIDNIGHT_CHAIN_ID, TOURNAMENT_FINALIZER_ADDRESS } from './midnight/config';

export type ChainId = number;
export const ZERO_ADDRESS = '0'.repeat(64);

export type ContractAddresses = { TournamentFinalizer: string };

export const CONTRACT_ADDRESSES: Record<ChainId, ContractAddresses> = {
  [MIDNIGHT_CHAIN_ID]: { TournamentFinalizer: TOURNAMENT_FINALIZER_ADDRESS ?? ZERO_ADDRESS },
};

export const SUPPORTED_CHAIN_IDS = Object.keys(CONTRACT_ADDRESSES).map(Number);
export const isSupportedChain = (chainId: ChainId): boolean => SUPPORTED_CHAIN_IDS.includes(chainId);

export const getContractAddresses = (chainId: ChainId): ContractAddresses => {
  const a = CONTRACT_ADDRESSES[chainId];
  if (!a) throw new Error(`Chain ${chainId} is not supported`);
  return a;
};

export const getContractAddress = (chainId: ChainId, name: keyof ContractAddresses): string =>
  getContractAddresses(chainId)[name];
