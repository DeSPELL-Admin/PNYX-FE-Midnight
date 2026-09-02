'use client';

/**
 * useAuthSession — Midnight 서명 + JWT 쿠키 세션 훅
 *
 * 세션 판별은 "프로브" 방식이다: 토큰은 HttpOnly 쿠키라 JS 가 읽을 수 없으므로,
 * `GET /me` 를 던져 200 이면 인증, 401 이면 미인증으로 본다(react-query, retry:false).
 *
 * 로그인 흐름(signIn) — Lace `signData` 기반 Midnight 서명:
 *   getNonce → buildMidnightAuthMessage → wallet.api.signData(unshielded) → verifyMidnight
 *   → bumpIdentityGeneration() → 세션 쿼리 invalidate (재프로브 → authenticated)
 *
 * 로그아웃 흐름(signOut):
 *   logout → bumpIdentityGeneration() → 세션 쿼리 캐시 제거(미인증으로 환원)
 */

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, bumpIdentityGeneration } from '~/lib/api/client';
import { getMe, getNonce, logout, verifyMidnight } from '~/lib/api/auth';
import { buildMidnightAuthMessage } from '~/lib/auth/midnightAuth';
import { clearWalletStorage } from '~/lib/auth/walletStorage';
import { subscribePendingReauth, getPendingReauth } from '~/lib/auth/reauth';
import { useIsIframe } from '~/hooks/useIsIframe';
import { useMidnight } from '~/components/providers/MidnightProvider';
import { signMessage } from '~/lib/midnight/connector';

export type AuthStatus = 'authenticating' | 'authenticated' | 'unauthenticated';

export interface UseAuthSessionResult {
  status: AuthStatus;
  point: number | undefined;
  walletAddress: string | undefined;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  isSigningIn: boolean;
  error: Error | null;
}

export const authSessionKey = (address?: string) => ['auth', 'session', address ?? null] as const;

// 서명 동시 실행 가드(모듈 레벨) — auto sign-in 과 수동 버튼이 동시에 프롬프트를 띄우지 않게.
let signInFlight = false;

export function useAuthSession(): UseAuthSessionResult {
  const { address, chainId, wallet, disconnect } = useMidnight();
  const isIframe = useIsIframe();
  const queryClient = useQueryClient();

  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const pendingReauth = useSyncExternalStore(subscribePendingReauth, getPendingReauth, () => false);

  const sessionQuery = useQuery({
    queryKey: authSessionKey(address),
    queryFn: getMe,
    retry: false,
    staleTime: 30_000,
    enabled: !pendingReauth,
  });

  const status: AuthStatus = useMemo(() => {
    if (pendingReauth) return 'authenticating';
    if (sessionQuery.isSuccess) return 'authenticated';
    if (sessionQuery.isPending) return 'authenticating';
    return 'unauthenticated';
  }, [pendingReauth, sessionQuery.isSuccess, sessionQuery.isPending]);

  const point = sessionQuery.data?.point;
  const walletAddress = sessionQuery.isSuccess ? address : undefined;

  const signIn = useCallback(async () => {
    if (!address || !wallet) throw new Error('지갑이 연결되어 있지 않습니다.');
    if (signInFlight) return;
    signInFlight = true;
    setIsSigningIn(true);
    setError(null);
    let signatureFailed = false;
    try {
      const { nonce, statement } = await getNonce();
      const message = buildMidnightAuthMessage({ address, chainId, nonce, statement });

      let signed: { data: string; signature: string; verifyingKey: string };
      try {
        signed = await signMessage(wallet.api, message);
      } catch (e) {
        signatureFailed = true;
        throw e;
      }

      await verifyMidnight(message, signed);
      bumpIdentityGeneration();
      await queryClient.invalidateQueries({ queryKey: authSessionKey(address) });
    } catch (e) {
      const err = e instanceof Error ? e : new Error('로그인 중 알 수 없는 오류가 발생했습니다.');
      setError(err);
      if (signatureFailed && !isIframe) {
        try { await disconnect(); } catch { /* ignore */ }
        clearWalletStorage();
        bumpIdentityGeneration();
        queryClient.removeQueries({ queryKey: authSessionKey(address) });
      }
      throw err;
    } finally {
      signInFlight = false;
      setIsSigningIn(false);
    }
  }, [address, wallet, chainId, disconnect, isIframe, queryClient]);

  const signOut = useCallback(async () => {
    try { await logout(); } catch { /* 쿠키는 만료에 맡김 */ }
    finally {
      bumpIdentityGeneration();
      queryClient.removeQueries({ queryKey: authSessionKey(address) });
    }
  }, [address, queryClient]);

  return { status, point, walletAddress, signIn, signOut, isSigningIn, error };
}

export { ApiError };
