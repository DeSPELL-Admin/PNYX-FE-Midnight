'use client';

/**
 * MidnightProvider — WagmiProvider 의 대체.
 *
 * 책임:
 *   1) Lace 연결 상태(주소/coin pk/ConnectedAPI)를 컨텍스트로 제공 (`useMidnight`)
 *   2) react-query QueryClient 싱글톤 + IdentitySync (지갑 전환 시 per-user 캐시/세션 정리 —
 *      WagmiProvider 의 IdentitySync 를 그대로 옮김)
 *   3) 마지막 연결 지갑을 localStorage 에 기억해 재방문 시 자동 재연결 시도
 *
 * midnight-js providers/컨트랙트 join 은 실제 트랜잭션 직전에 지연 생성한다(useFinalizeTournament).
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { connectWallet, findWallet, type ConnectedWallet } from '~/lib/midnight/connector';
import { MIDNIGHT_CHAIN_ID } from '~/lib/midnight/config';
import { bumpIdentityGeneration } from '~/lib/api/client';
import { logout } from '~/lib/api/auth';
import { setPendingReauth } from '~/lib/auth/reauth';
import { authSessionKey } from '~/hooks/auth/useAuthSession';

const RECONNECT_KEY = 'pnyx:midnight:autoconnect';

export type MidnightStatus = 'disconnected' | 'connecting' | 'connected';

export interface MidnightContextValue {
  status: MidnightStatus;
  wallet: ConnectedWallet | undefined;
  /** 지갑 unshielded 주소 (mn_addr_…) — 앱 전역의 `address` */
  address: string | undefined;
  chainId: number;
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  /** 확장이 감지됐는지 (버튼 활성화용) */
  isWalletAvailable: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const MidnightContext = createContext<MidnightContextValue | null>(null);

// 싱글톤 QueryClient. 신원(주소) 변경 시 IdentitySync 가 clear() 로 비운다.
const queryClient = new QueryClient();

function IdentitySync({ address }: { address: string | undefined }) {
  const prevAddressRef = useRef<string | undefined>(undefined);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevAddressRef.current = address;
      return;
    }
    const prev = prevAddressRef.current;
    if (prev !== address) {
      prevAddressRef.current = address;
      bumpIdentityGeneration();
      queryClient.clear();
      if (prev && address) {
        setPendingReauth(true);
        void (async () => {
          try { await logout(); } catch { /* 만료에 맡김 */ }
          finally {
            bumpIdentityGeneration();
            setPendingReauth(false);
            queryClient.invalidateQueries({ queryKey: authSessionKey(address) });
          }
        })().catch(() => {});
      }
    }
  }, [address]);

  return null;
}

export function MidnightProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<MidnightStatus>('disconnected');
  const [wallet, setWallet] = useState<ConnectedWallet | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [isWalletAvailable, setWalletAvailable] = useState(false);
  const connectingRef = useRef(false);

  // 확장 주입 감지(폴링 2초)
  useEffect(() => {
    let tries = 0;
    const id = setInterval(() => {
      if (findWallet()) { setWalletAvailable(true); clearInterval(id); }
      else if (++tries > 20) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, []);

  const connect = useCallback(async () => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    setStatus('connecting');
    setError(null);
    try {
      const w = await connectWallet();
      setWallet(w);
      setStatus('connected');
      try { localStorage.setItem(RECONNECT_KEY, '1'); } catch { /* ignore */ }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      setStatus('disconnected');
      setWallet(undefined);
      throw err;
    } finally {
      connectingRef.current = false;
    }
  }, []);

  const disconnect = useCallback(async () => {
    // DApp connector 에 disconnect 가 없다 — 앱 측 상태만 내리고 자동 재연결 플래그를 지운다.
    setWallet(undefined);
    setStatus('disconnected');
    try { localStorage.removeItem(RECONNECT_KEY); } catch { /* ignore */ }
  }, []);

  // 재방문 자동 재연결: 이전에 연결했던 브라우저면 Lace 가 승인 없이 곧바로 이어준다.
  useEffect(() => {
    if (!isWalletAvailable) return;
    let remembered = false;
    try { remembered = localStorage.getItem(RECONNECT_KEY) === '1'; } catch { /* ignore */ }
    if (remembered && status === 'disconnected' && !wallet) {
      void connect().catch(() => { /* 사용자가 거절하면 로그인 화면에서 수동 연결 */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWalletAvailable]);

  const value = useMemo<MidnightContextValue>(() => ({
    status,
    wallet,
    address: wallet?.unshieldedAddress,
    chainId: MIDNIGHT_CHAIN_ID,
    isConnected: status === 'connected' && !!wallet,
    isConnecting: status === 'connecting',
    error,
    isWalletAvailable,
    connect,
    disconnect,
  }), [status, wallet, error, isWalletAvailable, connect, disconnect]);

  return (
    <MidnightContext.Provider value={value}>
      <QueryClientProvider client={queryClient}>
        <IdentitySync address={value.address} />
        {children}
      </QueryClientProvider>
    </MidnightContext.Provider>
  );
}

export function useMidnight(): MidnightContextValue {
  const ctx = useContext(MidnightContext);
  if (!ctx) throw new Error('useMidnight must be used within <MidnightProvider>');
  return ctx;
}

export default MidnightProvider;
