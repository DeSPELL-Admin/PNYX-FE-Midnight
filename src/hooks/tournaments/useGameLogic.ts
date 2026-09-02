import { useState, useEffect, useCallback, useRef } from 'react';
import { useChainId, useAccount } from '~/hooks/wallet';
import { buildImageUrl } from '~/lib/api/files';
import { getTournamentsRandomItems, getTournamentItemById } from '~/lib/api/tournaments';
import { Candidate, GameStatus, RoundInfo } from '~/lib/api/types';
import { toast } from '~/hooks/use-toast';
import {
    initState,
    submitMatchResult,
    commitRound,
    getFinalArray,
    packFinalHex,
} from '~/lib/worldcup/lwa';
import type { LWState } from '~/lib/worldcup/type';
import {
    loadGameProgress,
    saveGameProgress,
    removeGameProgress,
} from '~/lib/game-progress';

interface GameMeta {
    title?: string;
    firstItemImageName?: string;
    secondItemImageName?: string;
}

interface UseGameLogicProps {
    tournamentId: number | null;
    totalRound?: number;
    // 진행 상태를 localStorage에 저장/복원할지 여부. 실제 플레이 인스턴스에서만 true.
    persist?: boolean;
    // 진행 목록 카드 표시용 메타
    meta?: GameMeta;
}

// candidate.id(string) → LWA ItemId(number) 매핑.
// 숫자가 아니면(mock 등) throw → initLwState 가 lwState 를 null 로 두어
// finalHex 가 산출되지 않게 한다. (mock/무효 id 가 itemId 0 으로 온체인 제출에
// 누출되는 것을 막는 무결성 가드)
function toItemIds(candidates: Candidate[]): number[] {
    return candidates.map((c) => {
        const num = parseInt(c.id, 10);
        if (isNaN(num)) {
            throw new Error(`Non-numeric candidate id (mock/invalid), skipping LWA init: ${c.id}`);
        }
        return num;
    });
}

// 개발 환경 디버깅용 mock 후보 생성기 (순수 함수 — tournamentId 를 인자로 받는다).
// 운영에서는 절대 사용하지 않는다(C2). effect 의존성 누락 경고도 자연 해소.
function generateMockCandidates(count: number, tournamentId: number | null): Candidate[] {
    return Array.from({ length: count }).map((_, i) => ({
        id: `mock-${i + 1}`,
        name: `Candidate ${i + 1}`,
        imageName: `mock-${i + 1}`,
        imageUrl: `https://picsum.photos/seed/${tournamentId}-${i + 1}/400/600`,
    }));
}

export function useGameLogic({ tournamentId, totalRound = 16, persist = false, meta }: UseGameLogicProps) {
    const chainId = useChainId();
    // 진행 저장을 지갑별로 분리하기 위한 주소(다른 지갑의 이어하기 노출/오제출 방지)
    const { address } = useAccount();

    // Game State
    const [gameStatus, setGameStatus] = useState<GameStatus>('loading');
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [nextRoundCandidates, setNextRoundCandidates] = useState<Candidate[]>([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
    const [round, setRound] = useState(totalRound);
    const [winner, setWinner] = useState<Candidate | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    // LWA(온체인 제출용) 상태 — 게임 진행과 1:1로 함께 전이된다.
    const [lwState, setLwState] = useState<LWState | null>(null);

    // rounds(랜덤 아이템) 호출 dedupe.
    // getTournamentsRandomItems 는 비멱등이다 — BE 가 매 호출마다 풀에서 다른 랜덤 셋을
    // 서빙하고 playVerification 을 그 셋으로 덮어쓴다(upsert). React StrictMode(dev)의 effect
    // 이중 호출이나 deps 변동으로 두 번 불리면, BE 가 마지막에 기록한 셋과 게임이 실제로
    // 렌더·제출하는 셋이 어긋나 finalize 시 "Item ids do not match" 가 난다. 동일 파라미터
    // (chainId/tournamentId/totalRound/retryCount)에 대해 프로미스를 공유해 단 한 번만 서빙받는다.
    const roundsFetchRef = useRef<{
        key: string;
        promise: ReturnType<typeof getTournamentsRandomItems>;
    } | null>(null);

    // 최신 meta를 stale closure 없이 저장 시점에 참조하기 위한 ref
    const metaRef = useRef<GameMeta | undefined>(meta);
    useEffect(() => {
        metaRef.current = meta;
    }, [meta]);

    // 진행 상태 스냅샷 저장 헬퍼
    const persistSnapshot = useCallback(
        (next: {
            status: 'playing' | 'finished';
            candidates: Candidate[];
            nextRoundCandidates: Candidate[];
            currentMatchIndex: number;
            round: number;
            winner: Candidate | null;
            lwState: LWState | null;
        }) => {
            if (!persist) return;
            if (tournamentId === null || tournamentId === undefined || !chainId) return;
            saveGameProgress(address, {
                version: 1,
                chainId,
                tournamentId,
                totalRound,
                status: next.status,
                candidates: next.candidates,
                nextRoundCandidates: next.nextRoundCandidates,
                currentMatchIndex: next.currentMatchIndex,
                round: next.round,
                winner: next.winner,
                lwState: next.lwState,
                title: metaRef.current?.title,
                firstItemImageName: metaRef.current?.firstItemImageName,
                secondItemImageName: metaRef.current?.secondItemImageName,
                updatedAt: Date.now(),
            });
        },
        [persist, tournamentId, chainId, totalRound, address],
    );

    // Initialize Game Data
    useEffect(() => {
        let isMounted = true;

        // 새 게임의 LWA 초기 상태 생성 (실패 시 null — mock 등 비정상 id)
        const initLwState = (list: Candidate[]) => {
            try {
                setLwState(initState(toItemIds(list)));
            } catch (e) {
                console.error("Failed to init LWA state:", e);
                setLwState(null);
            }
        };

        // 데이터 로드 실패 처리(C2):
        // - 운영: 'error' 상태로 표면화하고 게임을 시작하지 않는다(잘못된 제출 차단).
        // - 개발: 기존 디버깅 편의를 위해 mock 으로 게임을 시작한다.
        const handleLoadFailure = (reason: string) => {
            if (!isMounted) return;
            console.warn(`Game data load failed: ${reason}`);
            if (process.env.NODE_ENV === 'development') {
                const mocks = generateMockCandidates(totalRound, tournamentId).sort(() => Math.random() - 0.5);
                setCandidates(mocks);
                initLwState(mocks);
                setGameStatus('playing');
            } else {
                setGameStatus('error');
            }
        };

        const initGame = async () => {
            // Check strictly for null/undefined to allow 0
            if (tournamentId === null || tournamentId === undefined) return;
            if (!chainId) return;

            // 0. 저장된 진행 상태가 있으면 복원 (랜덤 재요청 스킵)
            if (persist) {
                const saved = loadGameProgress(address, chainId, tournamentId);
                if (saved) {
                    if (isMounted) {
                        // 저장 시 imageUrl 은 비워 두므로(용량 절약) imageName 으로 직접 URL 을 복원한다.
                        const withUrl = (c: Candidate): Candidate => ({ ...c, imageUrl: buildImageUrl(c.imageName) });
                        setCandidates(saved.candidates.map(withUrl));
                        setNextRoundCandidates(saved.nextRoundCandidates.map(withUrl));
                        setCurrentMatchIndex(saved.currentMatchIndex);
                        setRound(saved.round);
                        setWinner(saved.winner ? withUrl(saved.winner) : null);
                        setLwState(saved.lwState);
                        setGameStatus(saved.status);
                    }
                    return;
                }
            }

            setGameStatus('loading');
            try {
                // 1. Fetch Random Item IDs (dedupe: 동일 파라미터엔 단 한 번만 서빙받는다).
                // StrictMode 이중 invoke 등으로 두 번 서빙되면 BE 기록 셋 ≠ 플레이 셋이 되어
                // finalize 가 "Item ids do not match" 로 실패하므로 프로미스를 공유한다.
                const fetchKey = `${chainId}:${tournamentId}:${totalRound}:${retryCount}`;
                if (roundsFetchRef.current?.key !== fetchKey) {
                    roundsFetchRef.current = {
                        key: fetchKey,
                        promise: getTournamentsRandomItems(chainId, tournamentId, totalRound),
                    };
                }
                const randomItemsResponse = await roundsFetchRef.current.promise;

                if (!randomItemsResponse || !randomItemsResponse.success || !randomItemsResponse.data) {
                    handleLoadFailure('randomItems response invalid');
                    return;
                }

                const { randomItemIds } = randomItemsResponse.data;
                // 2. Fetch Details
                const itemPromises = randomItemIds.map(async (itemId) => {
                    const itemRes = await getTournamentItemById(chainId, tournamentId, itemId);
                    if (itemRes && itemRes.success && itemRes.data) {
                        const itemData = itemRes.data;
                        return {
                            id: String(itemId),
                            name: itemData.name,
                            imageName: itemData.imageName,
                            // BE 공개 이미지 URL 을 직접 사용 → next/image 가 최적화·캐시한다.
                            // (이전: imageUrl '' 로 두고 Blob 프리로드 로더가 채우던 방식 — 제거됨)
                            imageUrl: buildImageUrl(itemData.imageName),
                        } as Candidate;
                    }
                    return null;
                });

                const fetchedCandidates = (await Promise.all(itemPromises)).filter((c): c is Candidate => c !== null);

                // 후보 수가 부족하면 토너먼트를 구성할 수 없다(LWA 는 2의 거듭제곱 필요).
                // 운영에서는 mock 으로 채우지 않고 에러로 처리(C2).
                if (fetchedCandidates.length < totalRound) {
                    handleLoadFailure(`insufficient candidates: ${fetchedCandidates.length}/${totalRound}`);
                    return;
                }

                if (isMounted) {
                    setCandidates(fetchedCandidates);
                    setNextRoundCandidates([]);
                    setCurrentMatchIndex(0);
                    setRound(totalRound);
                    setWinner(null);
                    initLwState(fetchedCandidates);
                    setGameStatus('playing');
                }

            } catch (error) {
                console.error("Error initializing game:", error);
                handleLoadFailure('exception during init');
            }
        };

        if (tournamentId !== null && tournamentId !== undefined) {
            initGame();
        }

        return () => {
            isMounted = false;
        };
    }, [tournamentId, totalRound, chainId, retryCount, persist, address]);

    // Game Logic Actions
    const submitVote = useCallback((winnerId: string) => {
        if (gameStatus !== 'playing') return;

        const currentLeft = candidates[currentMatchIndex * 2];
        const currentRight = candidates[currentMatchIndex * 2 + 1];

        // Safety check
        if (!currentLeft || !currentRight) return;

        const winnerCandidate = currentLeft.id === winnerId ? currentLeft : currentRight;
        const rightWon = currentRight.id === winnerId;
        const newNextRound = [...nextRoundCandidates, winnerCandidate];

        // Check Round Completion
        const isRoundFinished = currentMatchIndex + 1 >= candidates.length / 2;

        // LWA 상태 전이 (게임 진행과 동일 타이밍)
        // 전이 실패 시 이전 상태로 게임을 계속 진행하면 오염된 lwState 가 온체인 제출에
        // 새어나간다(M9). 따라서 에러 상태로 전환하고 진행을 즉시 중단한다.
        let nextLw = lwState;
        if (lwState) {
            try {
                nextLw = submitMatchResult(lwState, rightWon);
                if (isRoundFinished) {
                    nextLw = commitRound(nextLw);
                }
            } catch (e) {
                console.error("LWA transition failed:", e);
                toast({
                    title: '게임 상태 오류',
                    description: '대결 결과를 기록하지 못했습니다. 다시 시도해 주세요.',
                    variant: 'destructive',
                });
                setGameStatus('error');
                return;
            }
        }

        setNextRoundCandidates(newNextRound);
        setLwState(nextLw);

        if (isRoundFinished) {
            if (round === 2) {
                // Game Over
                setWinner(winnerCandidate);
                setGameStatus('finished');
                persistSnapshot({
                    status: 'finished',
                    candidates,
                    nextRoundCandidates: newNextRound,
                    currentMatchIndex,
                    round,
                    winner: winnerCandidate,
                    lwState: nextLw,
                });
            } else {
                // Next Round
                const nextRound = round / 2;
                setCandidates(newNextRound);
                setNextRoundCandidates([]);
                setCurrentMatchIndex(0);
                setRound(nextRound);
                persistSnapshot({
                    status: 'playing',
                    candidates: newNextRound,
                    nextRoundCandidates: [],
                    currentMatchIndex: 0,
                    round: nextRound,
                    winner: null,
                    lwState: nextLw,
                });
            }
        } else {
            // Next Match
            const nextIndex = currentMatchIndex + 1;
            setCurrentMatchIndex(nextIndex);
            persistSnapshot({
                status: 'playing',
                candidates,
                nextRoundCandidates: newNextRound,
                currentMatchIndex: nextIndex,
                round,
                winner: null,
                lwState: nextLw,
            });
        }
    }, [candidates, currentMatchIndex, gameStatus, nextRoundCandidates, round, lwState, persistSnapshot]);

    // Current Round Info for UI
    // gameStatus === 'playing' 일 때만 계산되므로 이 시점 winner 는 항상 null →
    // progress 의 winner 분기는 데드 코드라 제거(L).
    const currentRoundInfo: RoundInfo | null = gameStatus === 'playing' && candidates.length >= 2 ? {
        round: round,
        roundTitle: round === 2 ? 'Final' : `ROUND OF ${round}`,
        currentMatchIndex: currentMatchIndex + 1,
        totalMatches: candidates.length / 2,
        leftCandidate: candidates[currentMatchIndex * 2],
        rightCandidate: candidates[currentMatchIndex * 2 + 1],
        progress: (currentMatchIndex / (candidates.length / 2)) * 100
    } : null;

    // 최종 LWA 결과 (온체인 제출용) — 토너먼트가 끝나야 산출된다.
    const finalArray = lwState && lwState.groups.length === 1 ? getFinalArray(lwState) : undefined;
    const finalHex = lwState && lwState.groups.length === 1 ? packFinalHex(lwState) : undefined;

    const resetGame = useCallback(() => {
        // "처음부터" → 저장된 진행 상태 제거 후 새 게임
        if (persist && tournamentId !== null && tournamentId !== undefined && chainId) {
            removeGameProgress(address, chainId, tournamentId);
        }
        setGameStatus('loading');
        setCandidates([]);
        setNextRoundCandidates([]);
        setWinner(null);
        setLwState(null);
        setRetryCount(prev => prev + 1);
    }, [persist, tournamentId, chainId, address]);

    return {
        gameStatus,
        currentRoundInfo,
        winner,
        submitVote,
        resetGame,
        candidates,
        finalArray,
        finalHex,
    };
}
