'use client';

import { useChainId } from '~/hooks/wallet';
import { CHAIN_IDS } from '~/lib/chains';

export function useSupportedChainGuard() {
  const chainId = useChainId();
  const isSupported = chainId != null && CHAIN_IDS.includes(chainId);
  const requiresSwitch = chainId != null && !isSupported;
  return { chainId, isSupported, requiresSwitch };
}
