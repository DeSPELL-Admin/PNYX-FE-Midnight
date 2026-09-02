"use client";

import { ChevronRight, ExternalLink, ArrowLeft } from 'lucide-react';
import ItemImage from '~/components/ui/ItemImage';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState, use } from 'react';
import { useTranslations } from 'next-intl';
import { useIntersectionObserver } from '~/hooks/useIntersectionObserver';
import Help from '~/assets/icons/help.svg'
import { useAccount, useChainId } from '~/hooks/wallet';
import { useTournament, useTournamentItem, useTournamentStats } from '~/hooks';
import { buildImageUrl } from '~/lib/api/files';
import { useUserTournamentPlayDetail } from '~/hooks/user';
import StatisticItem from './_components/StatisticItem';
import { CHAINS } from '~/lib/chains';
import { TournamentItemStat } from '~/lib/api/types';
import { Spinner } from '~/components/ui/Spinner';
import IconButton from '~/components/ui/IconButton';

// 모달은 진입 직후 필요 없으므로 클라이언트에서만 동적 로드 → 초기 번들 절감 (M12)
const StatisticsInfoModal = dynamic(() => import('./_components/StatisticsInfoModal'), { ssr: false });
const TournamentSelectedModal = dynamic(() => import('~/components/modals/TournamentSelectedModal'), { ssr: false });

export default function ChampionDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const tHall = useTranslations('hall');
    const tCommon = useTranslations('common');
    const { id } = use(params);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

    const chainId = useChainId();
    const { address } = useAccount();

    // 토너먼트 기본정보
    const {
        data: tournamentData,
        isError: isTournamentError,
        refetch: refetchTournament,
    } = useTournament(chainId, Number(id));

    // 해당 토너먼트에 대한 나의 선택 및 결과
    const { data: userTournamentPlayDetail } = useUserTournamentPlayDetail(chainId, address, Number(id));
    // 나의 1등 선택 이미지 데이터
    const { data: myPickImageData } = useTournamentItem(chainId, Number(id), userTournamentPlayDetail?.data?.[0]?.firstItemId || 0);
    const myPickImage = buildImageUrl(myPickImageData?.data?.imageName ?? '');

    // 나의 투표 트랜잭션 → 블록 익스플로러 링크 (mypage Transaction 메뉴 대체)
    const txHash = userTournamentPlayDetail?.data?.[0]?.txHash;
    const explorerBaseUrl = CHAINS.find((c) => c.id === chainId)?.blockExplorers?.default?.url;

    // 해당 토너먼트에 대한 통계
    const {
        data: tournamentStats,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isError: isStatsError,
        refetch: refetchStats,
    } = useTournamentStats(chainId, Number(id));

    // 핵심 쿼리(기본정보 · 통계) 실패 시 빈 화면 대신 에러 + 재시도 UI 노출
    const hasError = isTournamentError || isStatsError;
    const handleErrorRetry = () => {
        if (isTournamentError) refetchTournament();
        if (isStatsError) refetchStats();
    };

    // Infinite Scroll Ref
    const { isIntersecting, ref } = useIntersectionObserver({
        threshold: 0.5,
    })

    useEffect(() => {
        if (isIntersecting && hasNextPage) {
            fetchNextPage()
        }
    }, [isIntersecting, hasNextPage, fetchNextPage])

    // Flatten data for rendering
    const allStatistics = tournamentStats?.pages.flatMap((page) => page?.data ?? []) ?? [];

    const [isRetryModalOpen, setIsRetryModalOpen] = useState(false);

    const handleRetry = () => {
        setIsRetryModalOpen(true);
    }

    return (
        <div className="min-h-screen mx-auto max-w-[430px] bg-primary flex flex-col animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex items-center p-4">
                <IconButton
                    onClick={() => router.back()}
                    className="-ml-2"
                    aria-label={tCommon('back')}
                >
                    <ArrowLeft size={24} />
                </IconButton>
            </div>

            {hasError ? (
                /* 핵심 데이터 로드 실패 — 다크 UI 규칙 준수(bg-primary / text-white) */
                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
                    <p className="text-sm leading-relaxed text-brand-primary-300">{tHall('loadFailed')}</p>
                    <button
                        type="button"
                        onClick={handleErrorRetry}
                        className="rounded-[8px] bg-brand-primary-800 px-6 py-3 font-semibold text-white hover:bg-brand-primary-700"
                    >
                        {tHall('retryButton')}
                    </button>
                </div>
            ) : (
            /* Content */
            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
                {/* Title */}
                <h1 className="text-white text-[20px] font-[600] leading-[20px]"
                    style={{ letterSpacing: -0.36 }}>
                    {tournamentData?.data?.title}
                </h1>

                {/* My Pick */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <h3 className="text-[14px] font-[600] border border-point-yellow px-[10px] py-1 rounded-[8px] text-point-yellow mb-2">{tHall('myPick')}</h3>
                    </div>
                    <div className="flex gap-2 aspect-[1/1] w-full rounded-xl overflow-hidden shadow-sm">
                        <div className="relative w-full h-full">
                            <ItemImage src={myPickImage} alt={myPickImageData?.data?.name || ''} spinnerSize={28} />
                            <div className="absolute inset-0 z-1150" style={{ background: `linear-gradient(180deg, rgba(25, 25, 25, 0.00) 0%, rgba(25, 25, 25, 0.50) 100%)` }} />
                            <div className="absolute right-4 bottom-4 flex items-center justify-center">
                                <h3 className="text-[20px] text-white font-roboto" style={{
                                    WebkitTextStrokeWidth: '0.6px',
                                    WebkitTextStrokeColor: '#000',
                                    fontFamily: 'Roboto',
                                    fontStyle: 'italic',
                                    lineHeight: 'normal',
                                    letterSpacing: '-0.36px',
                                    paintOrder: 'stroke fill',
                                }}>{myPickImageData?.data?.name}</h3>
                            </div>
                        </div>
                    </div>
                    {txHash && explorerBaseUrl && (
                        <a
                            href={`${explorerBaseUrl}/tx/${txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="self-start inline-flex items-center gap-1 text-[13px] font-[500] text-brand-primary-200 hover:text-white"
                        >
                            {tHall('viewTransaction')}
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    )}
                </div>

                {/* Pick Ranking */}
                <div className="flex flex-col gap-2">
                    <div className="flex justify-end items-center">
                        <div
                            role="button"
                            tabIndex={0}
                            aria-label={tCommon('retry')}
                            className=" text-white flex items-center gap-2 text-[14px] font-[600] bg-[#303030] px-[11px] py-[6px] rounded-[8px] cursor-pointer"
                            onClick={handleRetry}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleRetry();
                                }
                            }}
                        >
                            <h3 className="">{tCommon('retry')}</h3>
                            <ChevronRight className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <h3 className="text-[14px] font-[600] border border-gray-700  px-[10px] py-1 rounded-[8px] text-gray-200 mb-2">{tHall('ranking')}</h3>
                        </div>
                        <IconButton
                            onClick={() => setIsInfoModalOpen(true)}
                            variant="subtle"
                            size="sm"
                            className="-mr-1"
                            aria-label={tHall('statisticsInfo')}
                        >
                            <Help className="w-6 h-4" />
                        </IconButton>
                    </div>

                    {/* Placeholder for more stats or details */}
                    {allStatistics.map((statistic: TournamentItemStat, idx: number) => (
                        <StatisticItem key={`${statistic.itemId}-${idx}`} statistic={statistic} rank={idx + 1} />
                    ))}

                    {/* Loading Indicator / Sentinel */}
                    <div ref={ref} className="h-10 flex items-center justify-center w-full">
                        {isFetchingNextPage && <Spinner className="text-white" size={20} />}
                    </div>
                </div>
            </div>
            )}

            <StatisticsInfoModal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} />
            <TournamentSelectedModal
                isOpen={isRetryModalOpen}
                onClose={() => setIsRetryModalOpen(false)}
                tournament={tournamentData?.data ? { ...tournamentData.data, tournamentId: Number(id) } : null}
            />
        </div>
    );
}
