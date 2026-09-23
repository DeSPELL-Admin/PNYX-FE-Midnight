"use client";

import { useState, useCallback, useEffect, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import Button from '~/components/ui/Button';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { DustNotReadyError, useFinalizeTournament, type FinalizePhase } from '~/hooks/contract/useFinalizeTournament';
import { getProofServerInfo, getProofServerInfoServerSnapshot, safeHost, subscribeProofServerInfo } from '~/lib/midnight/proofServer';
import { classifyWalletError } from '~/lib/midnight/dust';
import { useAccount, useChainId } from '~/hooks/wallet';
import { useTournament } from '~/hooks';
import { tournamentKeys } from '~/hooks/tournaments';
import { authSessionKey } from '~/hooks/auth/useAuthSession';
import Hall from '~/assets/icons/hall.svg';
import Replay from '~/assets/icons/replay.svg';
import Share from '~/assets/icons/share.svg';
import { ShareButton } from '~/components/ui/Share';
import { getPublicBaseUrl } from '~/lib/url';
import { Candidate } from '~/lib/api/types';
import { useToast } from '~/hooks/use-toast';
import { removeGameProgress } from '~/lib/game-progress';
import { fireCelebrationConfetti } from '~/lib/confetti';

interface ResultProps {
    tournamentId: string;
    winner: Candidate;
    onRetry: () => void;
    // LWA 결과 (임시 디버그용)
    finalArray?: number[];
    finalHex?: string;
    /** 피드에서 현재 보이는 게임인지 — 보이지 않는 완료 게임은 grant 를 미리 보내지 않는다(온체인 비용). */
    isActive?: boolean;
}

export default function Result({ tournamentId, winner, onRetry, finalArray, finalHex, isActive = true }: ResultProps) {
    const router = useRouter();
    const tTournament = useTranslations('tournament');
    const tCommon = useTranslations('common');
    const tError = useTranslations('error');
    const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
    // 서버에서 무효화된 이어하기(stale) 여부 — true 면 Submit 대신 안내 + "새 게임 시작" 패널을 띄운다.
    const [isStale, setIsStale] = useState(false);
    // BE finalize-confirm 이 재시도 끝에 실패 — 투표는 온체인이지만 포인트 반영이 늦을 수 있음을 알린다.
    const [confirmFailed, setConfirmFailed] = useState(false);

    const chainId = useChainId();
    const { address } = useAccount();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // 토너먼트 제목 (공유 카드용)
    const { data: tournamentData } = useTournament(chainId, Number(tournamentId));

    // X 공유 링크: /share/[id] OG 페이지로 카드(제목·내 픽·닉네임) 언퍼링
    const shareUrl = (() => {
        const u = new URL(`${getPublicBaseUrl()}/share/${tournamentId}`);
        u.searchParams.set('title', tournamentData?.data?.title || 'PNYX Tournament');
        if (winner?.imageName) u.searchParams.set('pick', winner.imageName);
        if (winner?.name) u.searchParams.set('pickName', winner.name);
        u.searchParams.set('by', address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'PNYX Player');
        return u.toString();
    })();

    // unknown 에러를 사람이 읽을 수 있는 문자열로 안전 내로잉.
    // viem 에러는 shortMessage 우선 → message → 마지막 String(err) 순.
    // description 이 절대 비거나 undefined 가 되지 않도록 보장한다.
    const resolveErrorMessage = useCallback((err: unknown): string => {
        // 사전 DUST 게이트에서 끊긴 경우 — 원인별로(NIGHT 미등록 / 생성 대기) 카드와 같은 문구를 쓴다.
        if (err instanceof DustNotReadyError) {
            return err.state === 'no_night' ? tTournament('dustNoNight') : tTournament('dustGenerating');
        }
        // 지갑 에러는 원문이 기술적이라("could not balance dust") 분류별로 사용자 문구로 바꾼다.
        // session_expired 는 *지갑 확장* 연결이 끊긴 것 — 앱 로그인 세션(sessionExpired)과 다르다.
        switch (classifyWalletError(err)) {
            case 'dust_insufficient': return tError('dustInsufficient');
            case 'session_expired': return tError('walletReconnect');
            case 'rejected': return tError('userRejection');
            default: break;
        }
        if (err && typeof err === 'object') {
            const e = err as { shortMessage?: unknown; message?: unknown };
            if (typeof e.shortMessage === 'string' && e.shortMessage) return e.shortMessage;
            if (typeof e.message === 'string' && e.message) return e.message;
        }
        return String(err) || tError('unknownError');
    }, [tError, tTournament]);

    // 어느 proof server 가 이 투표의 witness 를 받는지 — prewarm 이 providers 를 조립하면 채워진다.
    const proofServer = useSyncExternalStore(subscribeProofServerInfo, getProofServerInfo, getProofServerInfoServerSnapshot);

    const { finalizeTournament, prepareFinalize, phase, feeStatus, isCheckingFee, checkFee } = useFinalizeTournament(chainId, () => {
        // 트랜잭션 제출 직후 — 투표는 이미 온체인이므로 여기서 성공 화면으로 전환한다.
        // 포인트 반영(BE confirm)과 escrow 는 백그라운드로 이어지고 `phase` 가 'done' 이 되면 끝난다.
        setTxStatus('success');
        // 온체인 제출 성공 → 저장된 진행 상태 삭제 (이어하기 목록에서 제거)
        removeGameProgress(address, chainId, Number(tournamentId));
        fireCelebrationConfetti();
    }, ({ error }) => {
        toast({
            variant: "destructive",
            title: tError('title'),
            description: resolveErrorMessage(error),
        });
        setTxStatus('error');
    }, ({ confirmed }) => {
        if (!confirmed) setConfirmFailed(true);
        // BE finalize-confirm 까지 끝난 뒤 서버측 상태 동기화: 리스트의 per-user `status` 가 completed 로
        // 뒤집히고 포인트/세션(/me) 잔액이 갱신되도록 관련 쿼리를 무효화한다.
        queryClient.invalidateQueries({ queryKey: tournamentKeys.all });
        // 포인트는 세션 쿼리(authSessionKey)에 통합 — 세션 무효화로 함께 갱신된다.
        queryClient.invalidateQueries({ queryKey: authSessionKey(address) });
    })

    // Result 화면에 도착하자마자 grant 요청과 세션 준비를 시작한다 — 사용자가 우승자를 보는 동안
    // BE 증명·블록 대기(~30s)가 흘러가므로 Submit 시점엔 증명만 남는다. 같은 브라켓이면 한 번만 보낸다.
    // 의존성은 값이 안정적인 원시 타입만 — finalArray 는 렌더마다 새 배열이라 넣으면 매 렌더 재실행된다.
    const bracketSize = finalArray?.length ?? 0;
    useEffect(() => {
        if (!isActive || txStatus !== 'idle' || isStale || !finalHex || bracketSize === 0) return;
        prepareFinalize({
            tournamentId: Number(tournamentId),
            tournamentData: finalHex as `0x${string}`,
            bracketSize,
        });
    }, [isActive, txStatus, isStale, finalHex, bracketSize, tournamentId, prepareFinalize]);

    // DUST 가 아직 없으면(NIGHT 미등록 / 생성 대기) Submit 을 막고 30s 마다 다시 읽는다 — 생성되는 즉시 풀린다.
    const feeBlocked = feeStatus === 'no_night' || feeStatus === 'generating';
    useEffect(() => {
        if (!feeBlocked || txStatus === 'pending') return;
        const id = setInterval(() => { void checkFee().catch(() => { /* 다음 주기에 재시도 */ }); }, 30_000);
        return () => clearInterval(id);
    }, [feeBlocked, txStatus, checkFee]);
    const handleRecheckFee = useCallback(() => { void checkFee().catch(() => { /* 카드가 그대로 남는다 */ }); }, [checkFee]);

    // 성공 화면에서 confirm/escrow 가 아직 진행 중인지 — 포인트 "반영 중" 표시용
    const isSettling = txStatus === 'success' && phase !== 'done';
    const settleNote = isSettling ? tTournament('pointsPending') : confirmFailed ? tTournament('pointsDelayed') : '';

    const handleSendTransaction = useCallback(async () => {
        // 제출할 데이터가 없으면(우승자/LWA 결과 누락) 조용히 return 하지 않고 안내한다.
        if (!winner || !finalHex || !finalArray?.length) {
            toast({
                variant: "destructive",
                title: tError('title'),
                description: tError('unknownError'),
            });
            setTxStatus('error');
            return;
        }

        setTxStatus('pending');
        try {
            // tournamentId 는 uint16, finalHex 는 0x-prefixed bytes(packFinalHex, 서버 검증용).
            // itemId(우승자)·segment 는 ZK 커밋으로만 체인에 올라간다.
            await finalizeTournament({
                tournamentId: Number(tournamentId),
                // LWA final array 전체 — [0]=우승. 회로가 매치 카운터까지 온체인에 올린다.
                bracket: finalArray ?? [],
                tournamentData: finalHex as `0x${string}`,
            })
        } catch (err) {
            const description = resolveErrorMessage(err);
            // 이어하기 stale 처리: 서버에 이 판의 playVerification 기록이 없거나
            // ("No play verification found") 서버가 서빙한 셋과 다르면("...served items"),
            // 이 저장 게임은 finalize 할 수 없다(서버 기록을 FE 가 복구 불가 — rounds 는 호출마다 랜덤).
            // 저장본을 여기서 조용히 삭제하지 않는다 — 사용자가 [Start a new game] 로 명시적으로
            // 새 판을 시작(onRetry→resetGame)할 때 정리된다. 그 전까지는 무슨 일이 일어났는지
            // 화면에 남겨 두어 진행이 소리 없이 사라지는 혼란(원래 동작)을 없앤다.
            if (/play verification|served items/i.test(description)) {
                setIsStale(true);
                toast({
                    variant: "destructive",
                    title: tError('staleGameTitle'),
                    description: tError('staleGameDesc'),
                });
                setTxStatus('error');
                return;
            }
            // finalizeTournament 는 onError 로 토스트를 처리하지만, 예기치 못한
            // 동기/비동기 throw 까지 포함해 항상 error 상태로 떨어지도록 보장한다.
            toast({
                variant: "destructive",
                title: tError('title'),
                description,
            });
            setTxStatus('error');
        }
    }, [winner, finalHex, finalArray, tournamentId, finalizeTournament, toast, tError, resolveErrorMessage]);

    const phaseLabel = (p: FinalizePhase) => {
        switch (p) {
            case 'granting': return tTournament('phaseGranting');
            case 'indexing': return tTournament('phaseIndexing');
            case 'joining': return tTournament('phaseJoining');
            case 'proving': return tTournament('phaseProving');
            case 'confirming': return tTournament('phaseConfirming');
            default: return tCommon('submit');
        }
    };

    return (
        <div className="w-full h-full overflow-y-auto">
            {/* Winner ItemBox - 콘텐츠가 들어갈 공간이 있으면 세로 중앙, 작은 화면(예: 422×636)에서는
                넘치지 않고 스크롤되도록 처리 (반응형) */}
            <div className="min-h-full flex items-center justify-center py-4">
            <div className="w-full max-w-sm bg-brand-primary-100/40 px-4 py-4 rounded-[15px] border border-white/30">
                <div className="text-center text-white font-bold text-2xl mb-4"
                    style={{
                        background: 'linear-gradient(125deg, #FFBE69 8.56%, #AC7CFF 91.44%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}
                >
                    {tTournament('finalSelection')}
                </div>
                <div className="relative w-full h-full aspect-[4/3]">
                    <Image
                        src={winner.imageUrl || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1000&auto=format&fit=crop'}
                        alt={winner.name}
                        fill
                        className="object-cover rounded-[15px]"
                        priority
                        draggable={false}
                    />
                    <div className="absolute w-full left-1/2 -translate-x-1/2 bottom-4 flex items-center justify-center"
                        style={{
                            WebkitTextStrokeWidth: '0.6px',
                            WebkitTextStrokeColor: '#000',
                            fontFamily: "Albert Sans",
                            fontSize: '20px',
                            fontStyle: 'italic',
                            fontWeight: '600',
                            lineHeight: 'normal',
                            letterSpacing: '-0.36px',
                        }}
                    >
                        <span className="text-white font-bold drop-shadow-lg">
                            {winner.name}
                        </span>
                    </div>
                </div>

                {/* Buttons - 이미지 바로 아래에 위치 (Flow from Image bottom) */}
                <div className=" w-full flex flex-col gap-3 pt-6">
                    {/* Transaction 성공 전 */}
                    {txStatus !== 'success' && (
                        isStale ? (
                            // 서버에서 무효화된 이어하기 — 저장본을 지우는 대신 이유를 설명하고
                            // 새 게임으로 유도한다. [Start a new game] → onRetry(resetGame) 가
                            // 저장본을 정리하고 같은 토너먼트를 새로 서빙(=서버 셋 갱신)한다.
                            <div className="flex flex-col items-center gap-3 w-full animate-in fade-in duration-200">
                                <p className="text-center text-sm text-brand-primary-100 px-2">
                                    {tError('staleGameDesc')}
                                </p>
                                <Button variant="ctaBlack" onClick={onRetry}>
                                    {tError('startNewGame')}
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center w-full gap-3">
                                <Button
                                    variant="ctaBlack"
                                    className=""
                                    onClick={handleSendTransaction}
                                    isLoading={txStatus === 'pending'}
                                    disabled={!finalHex || feeBlocked}
                                >
                                    {txStatus === 'pending' ? phaseLabel(phase) : tCommon('submit')}
                                </Button>
                                {feeBlocked && (
                                    // 수수료 DUST 가 아직 없다 — NIGHT 미등록이면 등록 안내, 등록됐으면 생성 대기 안내
                                    <div className="w-full space-y-1 rounded-[8px] border border-yellow-400/40 bg-yellow-500/10 px-3 py-2 text-center">
                                        <p className="text-[11px] text-yellow-200">
                                            {feeStatus === 'no_night' ? tTournament('dustNoNight') : tTournament('dustGenerating')}
                                        </p>
                                        <p className="text-[10px] text-white/70">{tTournament('dustHint')}</p>
                                        <button type="button" onClick={handleRecheckFee} disabled={isCheckingFee} className="text-[11px] font-semibold text-white underline underline-offset-2 disabled:opacity-50">
                                            {isCheckingFee ? tTournament('dustRechecking') : tTournament('dustRecheck')}
                                        </button>
                                    </div>
                                )}
                                {txStatus === 'pending' && phase === 'proving' && (
                                    <p className="text-center text-[11px] text-brand-primary-300 px-2">{tTournament('provingHint')}</p>
                                )}
                                {proofServer && (
                                    // 비공개 입력(선택·비밀값)이 어디로 가는지 — 모바일에선 title 이 안 보이므로 본문으로 쓴다.
                                    <div className="text-center text-[10px] text-brand-primary-400 px-2 space-y-0.5">
                                        <p>
                                            {tTournament('proofServerLabel')} · {tTournament(`proofServer_${proofServer.source}`)}
                                            <span className="font-mono opacity-70"> ({safeHost(proofServer.url)})</span>
                                        </p>
                                        <p className="opacity-80">{tTournament('proofServerHint')}</p>
                                    </div>
                                )}
                            </div>
                        )
                    )}

                    {/* Transaction 성공 후: Home, Retry, Champion 버튼 등장 */}
                    {txStatus === 'success' && (
                        <div className="flex flex-col w-full justify-center items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {/* aria-live 영역은 항상 마운트해 두고 텍스트만 바꾼다(스크린리더가 변화를 안정적으로 읽도록) */}
                            <p
                                className={`text-center text-[11px] text-brand-primary-300 ${isSettling ? 'animate-pulse motion-reduce:animate-none' : ''} ${settleNote ? '' : 'hidden'}`}
                                aria-live="polite"
                            >
                                {settleNote}
                            </p>

                            <div className="flex items-center justify-center gap-3 w-full">
                                <Button variant="ctaBlack" className="gap-1 flex-1 rounded-[8px]" onClick={() => router.push(`/hall/${tournamentId}`)}>
                                    <Hall className="w-6 h-6" />
                                    {tCommon('result')}
                                </Button>
                                <Button variant="ctaBlack" className="gap-1 flex-1 rounded-[8px]" onClick={onRetry}>
                                    <Replay className="w-6 h-6" />
                                    {tCommon('retry')}
                                </Button>
                            </div>
                            <div className="flex items-center justify-center gap-3 w-full">
                                <ShareButton
                                    variant="ctaBlack"
                                    fullWidth
                                    className="gap-1 rounded-[8px]"
                                    text={tTournament('shareCast')}
                                    url={shareUrl}
                                >
                                    <Share className="w-6 h-4" />
                                    {tCommon('share')}
                                </ShareButton>
                            </div>
                        </div>
                    )}

                </div>
            </div>
            </div>
        </div>
    );
}
