'use client';

/**
 * finalize 플로우 (Midnight):
 *   1) userSecret(로컬) → userPk. BE 에 grant 요청 → BE 가 eligibility leaf 를 온체인에 삽입하고
 *      `{ point, deadline }` 를 돌려준다 (기존 EVM 서명 발급 흐름에 대응).
 *   2) 브라우저에서 ZK 증명 생성 → `finalizeTournament{16|32|64}(tid, point, deadline, bracket, segment)`
 *      제출. witness(userSecret, voteSalt, eligibilityPath)는 브라우저를 떠나지 않는다.
 *   3) (row, salt) 를 PNYX escrow 에 위탁 — 모든 투표가 데이터 마켓 판매 대상.
 *
 * 체감 대기 시간을 줄이기 위해 준비 작업을 앞당긴다:
 *   - 게임 시작 시 `TournamentGame` 이 `prewarmMidnight()` 로 WASM 로드 + providers/contract join + prover 키 prefetch
 *   - `prepareFinalize(...)` : Result 화면 도착 시 — grant 요청을 미리 보낸다(BE 증명 + 블록 대기 ~30s 를
 *                              사용자가 우승자를 보는 동안 흘려보낸다)
 *   - `finalizeTournament()` : Submit 클릭 — 위 둘을 재사용하고 grant ∥ join 을 병렬로 기다린 뒤 증명·제출
 *
 * 콜백 시점:
 *   - `onSuccess`  : 트랜잭션이 지갑을 거쳐 제출된 직후 (투표는 이미 온체인) → 화면은 여기서 성공으로 전환
 *   - `onSettled`  : BE finalize-confirm(포인트 반영) + escrow 시도가 끝난 뒤. `confirmed=false` 면 BE 확정 통보가
 *                    재시도 끝에 실패한 것 — 포인트가 늦게 반영될 수 있음을 화면에 알린다.
 *   진행 단계는 `phase` 로 노출한다. `done` 전까지는 "포인트 반영 중" 상태다.
 */

import { useCallback, useRef, useState } from 'react';
import { api } from '~/lib/api';
import type { FinalizeGrant } from '~/lib/api/signature';
import { useMidnight } from '~/components/providers/MidnightProvider';
import type { ConnectedWallet } from '~/lib/midnight/connector';
import { getOrCreateUserSecret, newVoteSalt, pad32, toHex } from '~/lib/midnight/userKeys';
import type { FinalizeBracketSize } from '~/lib/midnight/providers';
import { mark, markError } from '~/lib/midnight/finalizeTimeline';

// midnight-js + compact-runtime(WASM) 은 무겁고 브라우저 전용 → 실제 필요 시점에만 동적 로드한다.
const loadMidnight = () => import('~/lib/midnight/session');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 재시도 헬퍼 — 마지막 시도 뒤에는 기다리지 않는다. 끝내 실패하면 false. */
async function retry(label: string, attempts: number, intervalMs: number, fn: () => Promise<unknown>): Promise<boolean> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      await fn();
      return true;
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await sleep(intervalMs);
    }
  }
  // 제출 이후 단계의 실패는 온체인 투표를 되돌리지 못한다 — 경고만 남기고 호출자가 화면에 알린다.
  console.warn(`[finalize] ${label} failed after ${attempts} attempts (vote is on-chain):`, lastErr);
  return false;
}

const isBracketSize = (n: number): n is FinalizeBracketSize => n === 16 || n === 32 || n === 64;

/**
 * 확장 쪽 세션이 살아 있는지 확인한다. Lace 는 한동안 유휴 상태면 연결을 만료시키는데("Connection expired"),
 * 그걸 증명이 끝난 뒤 balance 단계에서야 알게 되면 증명 시간을 통째로 버린다 — 클릭 직후에 미리 확인한다.
 * 만료됐으면 같은 지갑으로 재연결을 시도하고, 살아 있는 ConnectedWallet 을 돌려준다.
 */
async function ensureWalletLive(
  wallet: ConnectedWallet,
  reconnect: () => Promise<ConnectedWallet>,
): Promise<ConnectedWallet> {
  const check = () => Promise.race([
    wallet.api.getConnectionStatus(),
    sleep(3_000).then(() => { throw new Error('Wallet status check timed out'); }),
  ]);
  // 1AM 은 background 가 유휴로 내려간 뒤 첫 요청이 'Request failed' 로 튕기고 곧 회복된다 — 재연결 전에 한 번 더 묻는다.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const status = await check();
      if (status.status === 'connected') return wallet;
      markError('wallet:expired', new Error(`Wallet status: ${status.status}`));
      break;
    } catch (e) {
      markError(attempt === 0 ? 'wallet:check:retry' : 'wallet:expired', e);
      if (attempt === 0) await sleep(1_500);
    }
  }
  mark('wallet:reconnect');
  let fresh: ConnectedWallet;
  try {
    fresh = await reconnect();
  } catch (e) {
    throw new Error('Wallet connection expired — please reconnect your wallet and submit again', { cause: e });
  }
  if (fresh.unshieldedAddress !== wallet.unshieldedAddress) {
    throw new Error('Wallet account changed — please submit again');
  }
  mark('wallet:reconnected');
  return fresh;
}

export type FinalizePhase = 'idle' | 'granting' | 'joining' | 'proving' | 'confirming' | 'done' | 'error';

export interface FinalizeParams {
  tournamentId: number;
  /** LWA final array — [0]=우승. 회로 인자이자 온체인 매치 카운터의 근거. 16/32/64강 */
  bracket: number[];
  /** 서버 검증·grant leaf 바인딩용 브라켓 인코딩(기존 tournamentData) */
  tournamentData: `0x${string}`;
  /** 1 집계만 · 2 세그먼트 · 3 로우 판매 동의 */
  segment?: string;
}

export interface PrepareParams {
  tournamentId: number;
  tournamentData: `0x${string}`;
  bracketSize: number;
}

type PreparedGrant = { key: string; grant: Promise<FinalizeGrant> };

export const useFinalizeTournament = (
  chainId: number | undefined,
  onSuccess: (info: { txId: string }) => void,
  onError: (params: { error: unknown }) => void,
  onSettled?: (info: { txId: string; confirmed: boolean }) => void,
) => {
  const { wallet, address, reconnect } = useMidnight();
  const [phase, setPhase] = useState<FinalizePhase>('idle');
  const [txId, setTxId] = useState<string | undefined>(undefined);
  const inFlight = useRef(false);
  // 미리 보낸 grant 요청. key = (chain, tournament, bracket, address) — 브라켓이 바뀌면(다시하기) 새로 보낸다.
  // BE 도 (wallet, tournament) 레코드의 entryItemHexes 가 같을 때만 재사용하므로 브라켓별로 leaf 가 발급된다.
  const prepared = useRef<PreparedGrant | null>(null);

  const requestGrant = useCallback((p: PrepareParams, key: string): Promise<FinalizeGrant> => {
    if (!chainId || !address) return Promise.reject(new Error('Wallet not connected'));
    mark('grant:request', { tournamentId: p.tournamentId, size: p.bracketSize });
    const grant = (async () => {
      const { pureCircuits } = await loadMidnight();
      const userSecret = getOrCreateUserSecret(address);
      const userPk = toHex(pureCircuits.userPublicKey(userSecret));
      const g = await api.signature.postTournamentFinalize(chainId, {
        tournamentId: p.tournamentId,
        tournamentData: p.tournamentData,
        userPk,
      });
      mark('grant:ready', { exists: g.exists, txId: g.txId?.slice(0, 10) });
      return g;
    })();
    const entry: PreparedGrant = { key, grant };
    prepared.current = entry;
    // 미리 보낸 요청이 실패하면 캐시에서 빼서 다음 prepare/Submit 이 다시 요청하게 한다.
    // (rejected promise 를 들고 있으면 Submit 한 번이 무조건 실패로 낭비된다.) unhandled rejection 도 여기서 막는다.
    grant.catch((e) => {
      markError('grant:failed', e);
      if (prepared.current === entry) prepared.current = null;
    });
    return grant;
  }, [chainId, address]);

  const grantKey = useCallback(
    (tournamentId: number, tournamentData: string) => `${chainId}:${tournamentId}:${tournamentData}:${address}`,
    [chainId, address],
  );

  /** Result 화면 도착 시: grant 를 미리 요청하고 세션/키도 준비한다. 같은 브라켓이면 한 번만 보낸다. */
  const prepareFinalize = useCallback((p: PrepareParams) => {
    if (!chainId || !wallet || !address || !isBracketSize(p.bracketSize)) return;
    const key = grantKey(p.tournamentId, p.tournamentData);
    if (prepared.current?.key !== key) {
      mark('result:prepare', { size: p.bracketSize });
      requestGrant(p, key);
    }
    const size = p.bracketSize;
    loadMidnight()
      .then((m) => m.prewarmMidnight(wallet, address, size))
      .catch((e) => console.warn('[finalize] prewarm failed:', e));
  }, [chainId, wallet, address, grantKey, requestGrant]);

  const finalizeTournament = useCallback(async (p: FinalizeParams) => {
    if (!chainId) { onError({ error: new Error('Chain not connected') }); return; }
    if (!wallet || !address) { onError({ error: new Error('Wallet not connected') }); return; }
    if (!isBracketSize(p.bracket.length)) {
      // 사이즈별 회로(finalizeTournament16/32/64)만 존재 — 기획상 라운드 선택지와 동일
      onError({ error: new Error(`Unsupported round count: ${p.bracket.length} (16/32/64 only)`) });
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    let submittedTxId: string | undefined;
    try {
      const size = p.bracket.length;
      const key = grantKey(p.tournamentId, p.tournamentData);
      const reusedGrant = prepared.current?.key === key;
      mark('click', { size, preparedGrant: reusedGrant });
      const mod = await loadMidnight();

      // 지갑 세션이 만료됐으면 여기서 바로 재연결한다 — 증명(수 초)을 마친 뒤 balance 에서 실패하지 않도록.
      // 재연결되면 wallet 객체가 바뀌므로 세션(providers/join)도 새 지갑으로 다시 만든다.
      const liveWallet = await ensureWalletLive(wallet, reconnect);

      // grant 와 세션 준비는 서로 독립 — 동시에 진행하고 순서대로 기다린다.
      const grantPromise = reusedGrant
        ? prepared.current!.grant
        : requestGrant({ tournamentId: p.tournamentId, tournamentData: p.tournamentData, bracketSize: size }, key);
      const sessionPromise = mod.getMidnightSession(liveWallet, address);
      sessionPromise.catch(() => undefined);

      setPhase('granting');
      const grant = await grantPromise; // 실패 시 requestGrant 의 catch 가 캐시를 비운다
      mark('grant:awaited');
      const segment = p.segment ?? grant.segment ?? 'all';

      setPhase('joining');
      const { providers } = await sessionPromise;
      mark('session:awaited');

      const userSecret = getOrCreateUserSecret(address);

      // grant leaf 가 인덱서에 보일 때까지 대기 (미리 보낸 grant 라면 보통 즉시 통과).
      // 끝내 안 보이면 증명은 InvalidSigner 로 확정 실패하므로 30s 증명을 낭비하지 않고 여기서 끊는다.
      setPhase('granting');
      const visible = await mod.waitForEligibilityLeaf(providers, {
        userPk: mod.pureCircuits.userPublicKey(userSecret),
        tournamentId: p.tournamentId,
        point: BigInt(grant.point),
        deadline: BigInt(grant.deadline),
        bracket: p.bracket,
      });
      if (!visible) {
        prepared.current = null;
        throw new Error('Eligibility grant is not visible on-chain yet. Please try again in a moment.');
      }

      // witness 가 읽을 private state 는 callTx 직전에 확정한다 — 투표마다 새 salt, escrow 에 같은 값을 보낸다.
      // (callTx 는 호출 시점에 privateStateProvider 를 다시 읽는다. 그 사이에 다른 write 가 끼면 안 되므로 바로 붙인다.)
      const voteSalt = newVoteSalt();
      await providers.privateStateProvider.set(mod.TF_PRIVATE_STATE_ID, { userSecret, voteSalt });

      setPhase('proving');
      mark('prove:start');
      const circuitName = `finalizeTournament${size}` as const;
      // 제출 직후 resolve — 인덱서 최종 반영 대기(≈18s)는 아래 confirm 폴링이 백그라운드에서 맡는다.
      const id = await mod.submitFinalizeAsync(providers, circuitName, [
        BigInt(p.tournamentId),
        BigInt(grant.point),
        BigInt(grant.deadline),
        p.bracket.map((x) => BigInt(x)),
        pad32(segment),
      ]);
      submittedTxId = id;
      mark('submitted', { txId: id.slice(0, 10) });
      setTxId(id);
      prepared.current = null; // grant 소비됨

      // 투표는 이미 온체인 — 화면은 여기서 성공으로 전환하고, 나머지는 백그라운드로 마무리한다.
      setPhase('confirming');
      onSuccess({ txId: id });

      // 3) BE 확정 통보(PlayInfo/포인트 반영)와 4) escrow 위탁은 서로 독립(BE escrow 는 grant 레코드만 확인) → 병렬.
      //    confirm 은 인덱서 반영을 기다려야 해서 길게, escrow 는 짧게 재시도한다.
      const [confirmed, escrowed] = await Promise.all([
        retry('finalize-confirm', 12, 5_000, () => api.signature.postFinalizeConfirm(chainId, { tournamentId: p.tournamentId, txId: id }))
          .then((ok) => { mark('confirm:done', { ok }); return ok; }),
        retry('escrow', 3, 3_000, () => api.signature.postEscrow(chainId, {
          tournamentId: p.tournamentId, itemId: p.bracket[0], segment, salt: toHex(voteSalt), txId: id, bracket: p.bracket,
        })).then((ok) => { mark('escrow:done', { ok }); return ok; }),
      ]);
      // escrow 실패는 판매 대상 제외를 뜻하지만 사용자가 할 수 있는 조치가 없어 화면에는 띄우지 않는다(로그만).
      if (!escrowed) console.warn('[finalize] vote excluded from data market (escrow failed)');

      setPhase('done');
      mark('done', { confirmed, escrowed });
      onSettled?.({ txId: id, confirmed });
    } catch (error) {
      if (submittedTxId) {
        // 제출 이후의 실패는 투표 자체와 무관 — 성공 화면을 유지하고 마무리만 끝낸 것으로 처리한다.
        console.warn('[finalize] post-submit step failed (vote is on-chain):', error);
        markError('post-submit:failed', error);
        setPhase('done');
        mark('done', { confirmed: false });
        onSettled?.({ txId: submittedTxId, confirmed: false });
        return;
      }
      markError('failed', error);
      // 원본 객체를 그대로 남긴다 — 지갑 에러는 message 가 비어 있고 code/info 에 내용이 있는 경우가 있다.
      console.error('[finalize] failed:', error);
      setPhase('error');
      onError({ error });
      throw error;
    } finally {
      inFlight.current = false;
    }
  }, [chainId, wallet, address, reconnect, onSuccess, onError, onSettled, grantKey, requestGrant]);

  return { finalizeTournament, prepareFinalize, phase, txId };
};
