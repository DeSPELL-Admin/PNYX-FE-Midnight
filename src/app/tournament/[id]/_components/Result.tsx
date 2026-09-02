"use client";

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import Button from '~/components/ui/Button';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useFinalizeTournament, type FinalizePhase } from '~/hooks/contract/useFinalizeTournament';
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
}

export default function Result({ tournamentId, winner, onRetry, finalArray, finalHex }: ResultProps) {
    const router = useRouter();
    const tTournament = useTranslations('tournament');
    const tCommon = useTranslations('common');
    const tError = useTranslations('error');
    const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
    // 서버에서 무효화된 이어하기(stale) 여부 — true 면 Submit 대신 안내 + "새 게임 시작" 패널을 띄운다.
    const [isStale, setIsStale] = useState(false);

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
        if (err && typeof err === 'object') {
            const e = err as { shortMessage?: unknown; message?: unknown };
            if (typeof e.shortMessage === 'string' && e.shortMessage) return e.shortMessage;
            if (typeof e.message === 'string' && e.message) return e.message;
        }
        return String(err) || tError('unknownError');
    }, [tError]);

    const { finalizeTournament, phase, txId } = useFinalizeTournament(chainId, () => {
        setTxStatus('success');
        // 온체인 제출 성공 → 저장된 진행 상태 삭제 (이어하기 목록에서 제거)
        removeGameProgress(address, chainId, Number(tournamentId));
        fireCelebrationConfetti();
        // finalize 후 서버측 상태 동기화: 리스트의 per-user `status` 가 completed 로 뒤집히고
        // 포인트/세션(/me) 잔액이 갱신되도록 관련 쿼리를 무효화한다.
        queryClient.invalidateQueries({ queryKey: tournamentKeys.all });
        // 포인트는 세션 쿼리(authSessionKey)에 통합 — 세션 무효화로 함께 갱신된다.
        queryClient.invalidateQueries({ queryKey: authSessionKey(address) });
    }, ({ error }) => {
        toast({
            variant: "destructive",
            title: tError('title'),
            description: resolveErrorMessage(error),
        });
        setTxStatus('error');
    })

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
    }, [winner, finalHex, tournamentId, finalizeTournament, toast, tError, resolveErrorMessage]);

    const phaseLabel = (p: FinalizePhase) => {
        switch (p) {
            case 'granting': return tTournament('phaseGranting');
            case 'joining': return tTournament('phaseJoining');
            case 'proving': return tTournament('phaseProving');
            case 'submitting': return tTournament('phaseSubmitting');
            case 'confirming': return tTournament('phaseConfirming');
            case 'escrowing': return tTournament('phaseEscrowing');
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
                                    disabled={!finalHex}
                                >
                                    {txStatus === 'pending' ? phaseLabel(phase) : tCommon('submit')}
                                </Button>
                                {txStatus === 'pending' && phase === 'proving' && (
                                    <p className="text-center text-[11px] text-brand-primary-300 px-2">{tTournament('provingHint')}</p>
                                )}
                            </div>
                        )
                    )}

                    {/* Transaction 성공 후: Home, Retry, Champion 버튼 등장 */}
                    {txStatus === 'success' && (
                        <div className="flex flex-col w-full justify-center items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">

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
