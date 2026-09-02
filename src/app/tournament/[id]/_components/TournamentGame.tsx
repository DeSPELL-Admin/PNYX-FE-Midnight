"use client";

import { useState, useEffect } from 'react';
import Image, { getImageProps } from 'next/image';
import { useTranslations } from 'next-intl';
import ItemBox, { ITEM_IMAGE_SIZES } from './ItemBox';
import Result from './Result';
import { useGameLogic, useTournament as useTournamentData } from '~/hooks';
import { useTournament } from '~/context/TournamentContext';
import { Candidate } from '~/lib/api/types';
import { useChainId } from '~/hooks/wallet';
import { Spinner } from '~/components/ui/Spinner';

interface TournamentGameProps {
    gameId: string;
    isActive: boolean;
    totalRound?: number;
}

export default function TournamentGame({ gameId, isActive, totalRound }: TournamentGameProps) {
    const chainId = useChainId();
    const tTournament = useTranslations('tournament');
    const tHome = useTranslations('home');
    const tCommon = useTranslations('common');

    // gameId 파싱 — NaN 이면 null 로 두어 게임 로직/데이터 호출에 전달하지 않는다(M5).
    const parsedGameId = Number.parseInt(gameId, 10);
    const numericGameId = Number.isFinite(parsedGameId) ? parsedGameId : null;

    const { data: tournamentData } = useTournamentData(
        chainId,
        numericGameId ?? 0,
        { enabled: numericGameId !== null },
    );

    const {
        gameStatus,
        currentRoundInfo,
        winner,
        submitVote,
        resetGame,
        candidates,
        finalArray,
        finalHex,
    } = useGameLogic({
        tournamentId: numericGameId,
        totalRound: totalRound || 16,
        persist: true,
        meta: {
            title: tournamentData?.data?.title,
            firstItemImageName: tournamentData?.data?.firstItemImageName,
            secondItemImageName: tournamentData?.data?.secondItemImageName,
        },
    });

    const { syncExternalGame } = useTournament();

    // Animation states — selectPhase: idle → center → up (선택 카드), 비선택은 페이드아웃
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectPhase, setSelectPhase] = useState<'idle' | 'center' | 'up'>('idle');
    const isAnimating = selectPhase !== 'idle';

    const defaultRoundTitleClass = `text-brand-primary-50 bg-brand-primary-100/30`;
    const finalRoundTitleClass = `text-[#FFC979] bg-[#5D361230]`;

    // 활성화된 게임을 컨텍스트에 동기화 (게임 상태도 함께 전달 — 컨텍스트는
    // 더 이상 자체 useGameLogic 을 돌리지 않고 이 값을 그대로 보관한다)
    useEffect(() => {
        if (isActive && candidates.length > 0 && numericGameId !== null) {
            syncExternalGame(numericGameId, gameStatus);
        }
    }, [candidates.length, isActive, numericGameId, gameStatus, syncExternalGame]);

    // 다가오는 매치 이미지 프리로드 — next/image 가 실제로 요청할 최적화 variant 를 getImageProps 로
    // 동일하게 계산해 미리 받아 둔다(원본 URL 프리로드는 /_next/image 와 안 맞아 캐시 미스라 무의미).
    // 현재 매치는 ItemBox 가 priority 로 즉시 렌더하므로, 그 "다음" 매치들만 앞당겨 받는다.
    const currentMatchNo = currentRoundInfo?.currentMatchIndex; // 1-based
    useEffect(() => {
        if (!isActive || typeof window === 'undefined' || candidates.length === 0 || !currentMatchNo) return;
        const PRELOAD_AHEAD = 8; // 다음 4매치(8장)
        const start = currentMatchNo * 2; // (1-based 매치번호 * 2) = 다음 매치의 첫 후보 인덱스
        const end = Math.min(start + PRELOAD_AHEAD, candidates.length);
        for (let i = start; i < end; i++) {
            const url = candidates[i]?.imageUrl;
            if (!url) continue;
            try {
                const { props } = getImageProps({ src: url, alt: '', fill: true, sizes: ITEM_IMAGE_SIZES });
                const img = new window.Image();
                if (props.sizes) img.sizes = props.sizes;
                if (props.srcSet) img.srcset = props.srcSet;
                if (props.src) img.src = props.src; // srcSet+sizes 로 적절 variant fetch → 렌더 시 캐시 히트
            } catch {
                // 프리로드는 best-effort — 실패해도 렌더 시 정상 로드된다.
            }
        }
    }, [candidates, currentMatchNo, isActive]);

    // Derived from hook
    const leftItem = currentRoundInfo?.leftCandidate;
    const rightItem = currentRoundInfo?.rightCandidate;
    const currentRound = currentRoundInfo?.round;
    const isFinalRound = !currentRound || currentRound === 2;
    const roundTitle = isFinalRound
        ? tTournament('roundFinal')
        : tHome('badgeRoundOf', { round: currentRound });
    const progress = currentRoundInfo?.progress || 0;

    // 애니메이션 종료 직후의 오탭으로 다음 후보가 선택되는 문제 방지 — 라운드 사이 고정 cooldown
    const [inCooldown, setInCooldown] = useState(false);

    // 선택 연출 타임라인: center(중앙) → up(위로 + 페이드) → submitVote(다음 라운드 진입)
    const T_CENTER = 250;
    const T_UP = 440;

    const handleSelect = (selected: Candidate) => {
        if (isAnimating || inCooldown || !leftItem || !rightItem) return;
        setSelectedId(selected.id);
        setSelectPhase('center');
        setTimeout(() => setSelectPhase('up'), T_CENTER);
        setTimeout(() => {
            // 모든 카드가 사라진 뒤 다음 라운드로 — 새 카드는 key 변경으로 remount 되며 아래에서 페이드인
            submitVote(selected.id);
            setSelectedId(null);
            setSelectPhase('idle');
            setInCooldown(true);
            setTimeout(() => setInCooldown(false), 350);
        }, T_CENTER + T_UP);
    };

    const handleRetry = () => {
        resetGame();
    };

    // 데이터 로드 실패(C2) 또는 유효하지 않은 게임 ID(M5) — 에러 화면.
    // 다크 UI 규칙: 배경은 항상 bg-primary 이므로 명시적 색상(text-white 등) 사용.
    if (gameStatus === 'error' || numericGameId === null) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center gap-4 p-6 text-center">
                <p className="text-white font-bold text-lg">
                    게임을 불러오지 못했습니다
                </p>
                <p className="text-brand-primary-100 text-sm">
                    네트워크 또는 데이터 문제로 토너먼트를 시작할 수 없습니다.
                </p>
                {numericGameId !== null && (
                    <button
                        type="button"
                        onClick={handleRetry}
                        className="mt-2 rounded-full bg-white px-6 py-2 text-sm font-semibold text-brand-primary-900 transition-opacity hover:opacity-90"
                    >
                        {tCommon('retry')}
                    </button>
                )}
            </div>
        );
    }

    if (gameStatus === 'loading' || ((!leftItem || !rightItem) && !winner)) {
        return (
            <div className="h-full flex items-center justify-center">
                <Spinner className="text-gray-400" />
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col items-center justify-center p-4 snap-start snap-always relative overflow-hidden">
            {/* Background Layers */}
            {isActive && (
                <div className="fixed max-w-[100vw] max-h-[100vh] inset-0 z-0">
                    <div className="max-w-[430px] bg-[#CFC7BC] w-full h-full m-auto relative">
                        {winner ? (
                            <>
                                <Image
                                    src={winner.imageUrl}
                                    alt="Winner Background"
                                    fill
                                    className="object-cover blur-xl opacity-60"
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                    priority
                                    draggable={false}
                                />
                                <div className="absolute inset-0 bg-black/40" />
                            </>
                        ) : (
                            <div
                                className="absolute top-0 left-0 w-full h-[30%]"
                                style={{
                                    background: 'linear-gradient(180deg, rgba(22, 22, 22, 0.40) 0%, rgba(70, 70, 70, 0.00) 100%)',
                                }}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="relative z-10 w-full h-full flex flex-col">
                {/* Header */}
                <div className="relative flex flex-col items-center justify-center border-gray-100 shrink-0">
                    {/* Progress Bar */}
                    <div className="w-full h-1 bg-brand-primary-300">
                        <div
                            className="h-full bg-white transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="text-left w-full py-2">
                        <span className={`${isFinalRound ? finalRoundTitleClass : defaultRoundTitleClass} text-[12px] rounded-full px-2 py-0.5`}>
                            {roundTitle}
                        </span>
                        <h1 className="text-white font-bold text-lg leading-tight mt-1 line-clamp-2">{tournamentData?.data?.title}</h1>
                    </div>
                </div>

                {/* Main Content Area */}
                {winner ? (
                    <div className="flex-1 min-h-0 w-full relative">
                        <Result
                            tournamentId={gameId}
                            winner={winner}
                            onRetry={handleRetry}
                            finalArray={finalArray}
                            finalHex={finalHex}
                        />
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col relative justify-center gap-2 pb-safe">
                        {/* 매치가 바뀌면 key 변경으로 remount → 아래에서 올라오며 페이드인(다음 라운드 등장) */}
                        <div
                            key={`${currentRound ?? 'r'}-${currentRoundInfo?.currentMatchIndex ?? 0}`}
                            className="flex flex-1 flex-col gap-2 animate-rise-from-footer"
                        >
                            {/* Upper / Left Item */}
                            <ItemBox
                                item={leftItem!}
                                position="top"
                                isSelected={selectedId === leftItem?.id}
                                selectPhase={selectPhase}
                                onClick={() => leftItem && handleSelect(leftItem)}
                                disabled={isAnimating || inCooldown}
                            />

                            {/* Lower / Right Item */}
                            <ItemBox
                                item={rightItem!}
                                position="bottom"
                                isSelected={selectedId === rightItem?.id}
                                selectPhase={selectPhase}
                                onClick={() => rightItem && handleSelect(rightItem)}
                                disabled={isAnimating || inCooldown}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
