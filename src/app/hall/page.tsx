"use client";

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Card from '~/components/ui/Card';
import CardSkeleton from '~/components/ui/CardSkeleton';
import Tabs from '~/components/ui/Tabs';
import { useChainId, useAccount } from '~/hooks/wallet';
import { useUserTournaments } from '~/hooks/user';
import { useIntersectionObserver } from '~/hooks/useIntersectionObserver';

// const MOCK_VOTED_WORLDCUPS = [
//   { id: 101, name: 'Best Anime 2024', description: 'Establish the ultimate champion among the most popular anime characters of the year.', imageUrl1: 'https://picsum.photos/id/10/500/500', imageUrl2: 'https://picsum.photos/id/11/500/500' },
//   { id: 102, name: 'Cute Dog Breeds', description: 'Which dog breed melts your heart the most?', imageUrl1: 'https://picsum.photos/id/237/500/500', imageUrl2: 'https://picsum.photos/id/238/500/500' },
//   { id: 103, name: 'Top Video Games', description: 'Vote for the game that defined the generation.', imageUrl1: 'https://picsum.photos/id/30/500/500', imageUrl2: 'https://picsum.photos/id/31/500/500' },
//   { id: 104, name: 'Delicious Foods', description: 'Egg, Chashu, Nori? What is essential?', imageUrl1: 'https://picsum.photos/id/302/500/500', imageUrl2: 'https://picsum.photos/id/303/500/500' },
//   { id: 105, name: 'Programming Languages', description: 'Which programming language is the most useful?', imageUrl1: 'https://picsum.photos/id/400/500/500', imageUrl2: 'https://picsum.photos/id/401/500/500' },
// ];

// const MOCK_CLOSED_WORLDCUPS = [
//   { tournamentId: 201, title: 'Best Movie 2023', firstItemImageName: 'https://picsum.photos/id/40/500/500', secondItemImageName: 'https://picsum.photos/id/41/500/500' },
//   { tournamentId: 202, title: 'Cat Breeds', firstItemImageName: 'https://picsum.photos/id/42/500/500', secondItemImageName: 'https://picsum.photos/id/43/500/500' },
//   { tournamentId: 203, title: 'Mobile Games', firstItemImageName: 'https://picsum.photos/id/44/500/500', secondItemImageName: 'https://picsum.photos/id/45/500/500' },
// ];

export default function ChampionPage() {
  const router = useRouter();
  const tHall = useTranslations('hall');
  const tCommon = useTranslations('common');
  const tHome = useTranslations('home');
  const [activeTab, setActiveTab] = useState('voted');

  const tabs = [
    { id: 'voted', label: tHall('tabVoted') },
    { id: 'closed', label: tHall('tabClosed') },
  ];

  const chainId = useChainId();
  const { address } = useAccount();

  const {
    data: votedTournamentsQuery,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isVotedLoading,
  } = useUserTournaments(chainId, address);

  const { ref } = useIntersectionObserver({
    enabled: hasNextPage,
    onIntersect: () => fetchNextPage(),
  });

  // 'closed' 탭은 아직 데이터 소스가 없는 placeholder(coming soon) → 로딩 없음.
  const isLoading = activeTab === 'voted' ? isVotedLoading : false;

  const filteredTournaments = useMemo(() =>
    activeTab === 'voted'
      ? votedTournamentsQuery?.pages.flatMap((page) => page?.data || []) || []
      : [],
    [activeTab, votedTournamentsQuery]
  );


  const handleItemClick = (id: number) => {
    router.push(`/hall/${id}`);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="z-10 px-4">
        <Tabs variant="box" tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          {isLoading && (
            Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))
          )}
          {!isLoading && filteredTournaments && filteredTournaments.length > 0 && (
            <>
              {filteredTournaments?.map((t, i) => {
                if (t.title) {
                  return (
                    <Card
                      key={i}
                      title={t.title}
                      imageName1={t.firstItemImageName}
                      imageName2={t.secondItemImageName}
                      onClick={() => handleItemClick(t.tournamentId)}
                    />
                  );
                }
                return null;
              })}

              {/* Sentinel for infinite scroll */}
              <div ref={ref} className="h-4 w-full flex justify-center">
                {isFetchingNextPage && <div className="text-white text-sm">{tCommon('loadingMore')}</div>}
              </div>
            </>
          )}
          {!isLoading && filteredTournaments && filteredTournaments.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-white">
              <p>{tHome('noCompletedEvents')}</p>
              <p className="text-[16px] font-[600]">{tCommon('comingSoon')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
