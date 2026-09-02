"use client";

import ItemImage from '~/components/ui/ItemImage';
import { buildImageUrl } from '~/lib/api/files';
import { TournamentItemOpponentStat, TournamentItemStat } from '~/lib/api/types';
import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '~/components/ui/Modal';
import { useTournamentItemStats } from '~/hooks/tournaments';
import { useChainId } from '~/hooks/wallet';
import { usePathname } from 'next/navigation';

interface StatisticItemProps {
    statistic: TournamentItemStat;
    rank: number;
}

// 0~100 경계 보호: 비율(0~1)을 퍼센트로 변환하고 범위를 클램프
const toClampedPercent = (rate: number) => Math.min(100, Math.max(0, (rate ?? 0) * 100));

// 순위 뱃지: 4자리 이상이면 글자 크기를 줄여 칸 안에 맞춤
const RankBadge = ({ rank }: { rank: number }) => (
    <div className="flex flex-none w-8 items-center justify-center gap-2">
        <h3 className={`${rank >= 1000 ? 'text-[10px]' : 'text-[16px]'} font-[600] text-gray-100 mb-2`}>{rank}</h3>
    </div>
);

// 퍼센트 바 1개: 라벨 + 진행바 + 퍼센트 수치. rate(0~1)를 0~100 으로 클램프하여 표시
const RateBar = ({ label, rate }: { label: string; rate: number }) => {
    const percent = toClampedPercent(rate);
    return (
        <div className="flex items-center gap-2 text-xs text-brand-primary-400 font-medium">
            <span className="w-8">{label}</span>
            <div className="flex-1 h-1.5 bg-brand-primary-700 rounded-full overflow-hidden">
                <div className="h-full bg-point-yellow rounded-full" style={{ width: `${percent}%` }} />
            </div>
            <span className="w-8 text-right">{Math.round(percent)}%</span>
        </div>
    );
};

export default function StatisticItem({ statistic, rank }: StatisticItemProps) {
    const tHall = useTranslations('hall');
    const imageUrl = buildImageUrl(statistic.imageName);
    // TEMP(2026-06-17): 구매/상세 모달 비활성 — 복원 시 주석 해제
    // const [isModalOpen, setIsModalOpen] = useState(false);

    // TEMP(2026-06-17): 구매/상세 모달 비활성 — 복원 시 주석 해제
    // 아이템별 대결 결과 모달 띄우는 함수
    // const handleOpenModal = () => {
    //     setIsModalOpen(true);
    // }

    // TEMP(2026-06-17): 구매/상세 모달 비활성 — 복원 시 주석 해제
    // 키보드 접근성: Enter/Space 로도 모달을 열 수 있도록
    // const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    //     if (e.key === 'Enter' || e.key === ' ') {
    //         e.preventDefault();
    //         handleOpenModal();
    //     }
    // }

    return (
        <>
            <div key={statistic.itemId} className="flex items-center gap-4 w-full justify-between bg-brand-primary-700/40 border border-brand-primary-600/30 p-2 rounded-[15px]">
                <RankBadge rank={rank} />
                <div className="flex flex-none w-20 h-20 items-center gap-2 relative rounded-lg overflow-hidden">
                    <ItemImage src={imageUrl} alt={statistic.name} spinnerSize={20} />
                </div>
                <div className="flex flex-1 flex-col justify-center gap-2">
                    <h3 className="text-[16px] text-gray-100">{statistic.name}</h3>
                    <div className="flex flex-col gap-1.5 w-full">
                        {/* WP Bar */}
                        <RateBar label={tHall('rank1st')} rate={statistic.firstRate} />
                        {/* OP Bar */}
                        <RateBar label={tHall('rank1v1')} rate={statistic.winRate} />
                    </div>
                </div>
            </div>
            {/* TEMP(2026-06-17): 구매/상세 모달 비활성 — 복원 시 주석 해제 */}
            {/* <ItemStatisticsDetailModal statistic={statistic} isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} /> */}
        </>
    );
}

const ItemStatisticsDetailModal = ({ statistic, isModalOpen, setIsModalOpen }: { statistic: TournamentItemStat, isModalOpen: boolean, setIsModalOpen: (value: boolean) => void }) => {
    const tHall = useTranslations('hall');
    const chainId = useChainId();
    const pathname = usePathname();
    const tournamentId = pathname.split('/').pop();
    const { data: ItemDetailStatistics, fetchNextPage, hasNextPage, isFetchingNextPage } = useTournamentItemStats(chainId!, Number(tournamentId), statistic.itemId);

    // Payment & UX States
    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'completed'>('idle');

    // Observer for infinite scroll
    const observerTarget = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasNextPage && paymentStatus === 'completed') {
                    fetchNextPage();
                }
            },
            { threshold: 1.0 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => observer.disconnect();
    }, [fetchNextPage, hasNextPage, paymentStatus]);

    const handleUnlock = () => {
        setPaymentStatus('processing');
        // Simulate payment processing time
        setTimeout(() => {
            setPaymentStatus('completed');
        }, 2000);
    };

    // Determine which items to show based on payment status
    // Flatten pages into a single array
    const allItems = ItemDetailStatistics?.pages.flatMap((page) => page?.data || []) || [];

    // Logic for visible and blurred items
    // If not completed, we only use the first few items from the first page (which is already loaded)
    const visibleItems = paymentStatus === 'completed' ? allItems : [];
    const blurredItems = paymentStatus === 'completed' ? [] : allItems.slice(0, 3); // visual placeholder for blur

    return (
        <Modal
            isOpen={isModalOpen}
            onClose={() => { setIsModalOpen(false); }}
        >
            <div className="relative flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {/* Base Item Header */}
                <BaseItemHeader statistic={statistic} />

                {/* Visible Items */}
                {visibleItems.map((statistic: TournamentItemOpponentStat, idx: number) => (
                    <ItemOpponentStatistic key={`${statistic.opponentItemId}-${idx}`} statistic={statistic} idx={idx} />
                ))}

                {/* Infinite Scroll Trigger */}
                {paymentStatus === 'completed' && (
                    <div ref={observerTarget} className="h-4 flex justify-center items-center w-full">
                        {isFetchingNextPage && <div className="w-5 h-5 border-2 border-brand-primary-500 border-t-transparent rounded-full animate-spin" />}
                    </div>
                )}

                {/* Blurred/Locked Area */}
                {paymentStatus !== 'completed' && (
                    <div className="relative">
                        {/* Fake blurred items to create visual context */}
                        <div className="flex flex-col gap-2 filter blur-sm opacity-50 select-none pointer-events-none mb-4">
                            {blurredItems.length > 0 ? blurredItems.map((statistic: TournamentItemOpponentStat, idx: number) => (
                                <ItemOpponentStatistic key={statistic.opponentItemId} statistic={statistic} idx={idx} />
                            )) : (
                                // Fallback mock items if not enough data to blur, just to show something
                                Array.from({ length: 3 }).map((_, idx) => (
                                    <div key={idx} className="h-[100px] w-full bg-brand-primary-700/40 rounded-[15px]" />
                                ))
                            )}
                        </div>

                        {/* Overlay CTA */}
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                            {paymentStatus === 'processing' ? (
                                <div className="bg-black/80 px-6 py-3 rounded-xl flex items-center gap-3 border border-brand-primary-500">
                                    <div className="w-5 h-5 border-2 border-point-yellow border-t-transparent rounded-full animate-spin" />
                                    <span className="text-point-yellow font-semibold">{tHall('processingPayment')}</span>
                                </div>
                            ) : (
                                <button
                                    onClick={handleUnlock}
                                    className="bg-point-yellow text-black px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-yellow-400 transition-transform active:scale-95 flex flex-col items-center gap-1"
                                >
                                    <span>{tHall('unlockFullStats')}</span>
                                    <span className="text-xs font-normal opacity-80">{tHall('simulateHint')}</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}

const ItemOpponentStatistic = ({ statistic, idx }: { statistic: TournamentItemOpponentStat, idx: number }) => {
    const tHall = useTranslations('hall');
    const imageUrl = buildImageUrl(statistic.opponentItemImageName);

    return (
        <div key={statistic.opponentItemId} className="flex items-center gap-4 w-full justify-between bg-brand-primary-700/40 border border-brand-primary-600/30 p-2 rounded-[15px]">
            <RankBadge rank={idx + 1} />
            <div className="flex flex-none w-20 h-20 items-center gap-2 relative rounded-lg overflow-hidden">
                <ItemImage src={imageUrl} alt={statistic.opponentItemName} spinnerSize={20} />
            </div>
            <div className="flex flex-1 flex-col justify-center gap-2">
                <h3 className="text-[16px] text-gray-100">{statistic.opponentItemName}</h3>
                <div className="flex flex-col gap-1.5 w-full">
                    {/* WP Bar */}
                    <RateBar label={tHall('rank1v1')} rate={statistic.winRate} />
                </div>
            </div>
        </div>
    );
}

const BaseItemHeader = ({ statistic }: { statistic: TournamentItemStat }) => {
    const tHall = useTranslations('hall');
    const imageUrl = buildImageUrl(statistic.imageName);

    return (
        <div className="flex flex-col items-center justify-center py-4 border-b border-brand-primary-600/30 mb-2">
            <div className="w-24 h-24 relative rounded-xl overflow-hidden mb-3 border-4 border-brand-primary-500/20 shadow-lg">
                <ItemImage src={imageUrl} alt={statistic.name} spinnerSize={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-100">{statistic.name}</h3>
            <div className="mt-3 px-4 py-1.5 bg-brand-primary-700/50 rounded-full text-xs font-bold text-brand-primary-300 flex items-center gap-2">
                <span>{tHall('vs')}</span>
                <span className="opacity-70 font-normal">{tHall('opponentsStats')}</span>
            </div>
        </div>
    );
}