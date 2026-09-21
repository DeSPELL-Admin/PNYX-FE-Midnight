'use client';

/**
 * MidnightProvider — WagmiProvider 의 대체.
 *
 * 책임:
 *   1) 지갑(Lace/1AM 등 DApp connector v4) 연결 상태(주소/coin pk/ConnectedAPI)를 컨텍스트로 제공 (`useMidnight`)
 *   2) react-query QueryClient 싱글톤 + IdentitySync (지갑 전환 시 per-user 캐시/세션 정리 —
 *      WagmiProvider 의 IdentitySync 를 그대로 옮김)
 *   3) 마지막 연결 지갑(rdns)을 localStorage 에 기억해 재방문 시 같은 지갑으로 자동 재연결 시도
 *
 * midnight-js providers/컨트랙트 join 은 실제 트랜잭션 직전에 지연 생성한다(useFinalizeTournament).
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { connectWallet, listWallets, type ConnectedWallet } from '~/lib/midnight/connector';
import { MIDNIGHT_CHAIN_ID } from '~/lib/midnight/config';
import { bumpIdentityGeneration } from '~/lib/api/client';
import { logout } from '~/lib/api/auth';
import { setPendingReauth } from '~/lib/auth/reauth';
import { authSessionKey } from '~/hooks/auth/useAuthSession';

/** 마지막으로 연결한 지갑의 rdns 를 저장한다. */
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
  /** 확장이 하나라도 감지됐는지 (버튼 활성화용) */
  isWalletAvailable: boolean;
  /** 감지된 호환 지갑 목록 (Lace, 1AM …) — 선택 UI 용 */
  wallets: InitialAPI[];
  /** rdns 생략 시 감지된 첫 지갑에 연결 */
  connect: (rdns?: string) => Promise<void>;
  /**
   * 확장 쪽 세션이 만료됐을 때(Lace "Connection expired") 같은 지갑으로 다시 연결하고 새 API 를 돌려준다.
   * 이전에 승인한 지갑이면 팝업 없이 이어지는 경우가 많다. 실패하면 상태를 disconnected 로 내리고 throw.
   */
  reconnect: () => Promise<ConnectedWallet>;
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
  const [wallets, setWallets] = useState<InitialAPI[]>([]);
  const connectingRef = useRef(false);

  // 확장 주입 감지(폴링 2초). 여러 확장이 시차를 두고 주입되므로 시간 내내 목록을 갱신한다.
  useEffect(() => {
    let tries = 0;
    const id = setInterval(() => {
      const found = listWallets();
      setWallets((prev) => (
        prev.length === found.length && prev.every((w, i) => w.rdns === found[i].rdns) ? prev : found
      ));
      if (++tries > 20) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, []);

  const connectAndStore = useCallback(async (rdns?: string): Promise<ConnectedWallet> => {
    if (connectingRef.current) throw new Error('Wallet connection already in progress');
    connectingRef.current = true;
    setStatus('connecting');
    setError(null);
    try {
      const w = await connectWallet(rdns);
      setWallet(w);
      setStatus('connected');
      try { localStorage.setItem(RECONNECT_KEY, w.walletRdns); } catch { /* ignore */ }
      return w;
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

  const connect = useCallback(async (rdns?: string) => {
    if (connectingRef.current) return;
    await connectAndStore(rdns);
  }, [connectAndStore]);

  const reconnect = useCallback(async () => {
    let rdns: string | undefined = wallet?.walletRdns;
    if (!rdns) {
      try { rdns = localStorage.getItem(RECONNECT_KEY) ?? undefined; } catch { /* ignore */ }
    }
    return connectAndStore(rdns);
  }, [wallet, connectAndStore]);

  const disconnect = useCallback(async () => {
    // DApp connector 에 disconnect 가 없다 — 앱 측 상태만 내리고 자동 재연결 플래그를 지운다.
    setWallet(undefined);
    setStatus('disconnected');
    try { localStorage.removeItem(RECONNECT_KEY); } catch { /* ignore */ }
  }, []);

  // 재방문 자동 재연결: 이전에 연결했던 지갑이 감지되면 승인 없이 곷바로 이어준다.
  // 다른 지갑만 감지된 경우에는 임의로 연결하지 않고 로그인 화면의 선택에 맡긴다.
  const reconnectTriedRef = useRef(false);
  useEffect(() => {
    if (reconnectTriedRef.current || wallets.length === 0) return;
    let remembered: string | null = null;
    try { remembered = localStorage.getItem(RECONNECT_KEY); } catch { /* ignore */ }
    if (!remembered || !wallets.some((w) => w.rdns === remembered)) return;
    reconnectTriedRef.current = true;
    if (status === 'disconnected' && !wallet) {
      void connect(remembered).catch(() => { /* 사용자가 거절하면 로그인 화면에서 수동 연결 */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets]);

  const isWalletAvailable = wallets.length > 0;

  const value = useMemo<MidnightContextValue>(() => ({
    status,
    wallet,
    address: wallet?.unshieldedAddress,
    chainId: MIDNIGHT_CHAIN_ID,
    isConnected: status === 'connected' && !!wallet,
    isConnecting: status === 'connecting',
    error,
    isWalletAvailable,
    wallets,
    connect,
    reconnect,
    disconnect,
  }), [status, wallet, error, isWalletAvailable, wallets, connect, reconnect, disconnect]);

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
