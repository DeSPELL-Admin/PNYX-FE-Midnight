'use client';

/**
 * 지갑 훅 어댑터 — wagmi 훅과 같은 이름/모양으로 노출해 화면 컴포넌트는 import 경로만 바꾼다.
 *
 *   useAccount()   → { address, isConnected, isConnecting, isReconnecting, connector }
 *   useChainId()   → 합성 Midnight chainId (MIDNIGHT_CHAIN_ID)
 *   useDisconnect()→ { disconnect, disconnectAsync, isPending }
 *   useConnect()   → { connect, connectAsync, isPending, error }
 */

import { useCallback, useState } from 'react';
import { useMidnight } from '~/components/providers/MidnightProvider';

export { useMidnight };

export function useAccount() {
  const { address, isConnected, isConnecting, wallet, chainId } = useMidnight();
  return {
    address,
    isConnected,
    isConnecting,
    isReconnecting: false,
    chainId: isConnected ? chainId : undefined,
    connector: wallet ? { id: wallet.walletRdns, name: wallet.walletName } : undefined,
  };
}

export function useChainId(): number {
  return useMidnight().chainId;
}

export function useDisconnect() {
  const { disconnect } = useMidnight();
  const [isPending, setPending] = useState(false);
  const disconnectAsync = useCallback(async () => {
    setPending(true);
    try { await disconnect(); } finally { setPending(false); }
  }, [disconnect]);
  return { disconnect: () => { void disconnectAsync(); }, disconnectAsync, isPending };
}

export function useConnect() {
  const { connect, isConnecting, error } = useMidnight();
  return { connect: (rdns?: string) => { void connect(rdns).catch(() => {}); }, connectAsync: connect, isPending: isConnecting, error };
}
