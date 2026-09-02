'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useChainId } from '~/hooks/wallet';
import HomeBanner from '~/app/_components/HomeBanner';
import NetworkGate from '~/app/_components/NetworkGate';
import TournamentToolbar, {
  SORT_TO_ORDER_BY,
  type TournamentFilter,
  type TournamentSort,
} from '~/app/_components/TournamentToolbar';
import TournamentList from '~/app/_components/TournamentList';
import InProgressTournamentList from '~/app/_components/InProgressTournamentList';
import { useTournaments } from '~/hooks';
import type { Tournament } from '~/lib/api/types';

// 토너먼트 선택 모달은 카드 선택 후에만 필요 → 클라이언트에서만 동적 로드 (M12)
const TournamentSelectedModal = dynamic(
  () => import('~/components/modals/TournamentSelectedModal'),
  { ssr: false },
);

export default function Home() {
  const [filter, setFilter] = useState<TournamentFilter>('all');
  const [sort, setSort] = useState<TournamentSort>('popular');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);

  const chainId = useChainId();

  // event 탭은 type='event', 나머지(all 포함)는 type='classic'
  // 훅 호출 순서를 항상 동일하게 유지하기 위해 type만 계산 후 단일 호출
  const type = filter === 'event' ? ('event' as const) : ('classic' as const);
  const { data: tournamentsData, isLoading: isTournamentsLoading } = useTournaments(
    chainId,
    1,
    10,
    SORT_TO_ORDER_BY[sort],
    undefined,
    type,
  );

  // TournamentSelectedModal에서 useTranslations 불필요 — 여기선 home 번역 미사용
  const tHome = useTranslations('home');

  return (
    <div className="pb-20">
      <HomeBanner />

      <TournamentToolbar
        chainId={chainId}
        filter={filter}
        onFilterChange={setFilter}
        sort={sort}
        onSortChange={setSort}
      />

      <div className="px-4">
        {filter === 'ongoing' ? (
          <InProgressTournamentList chainId={chainId} />
        ) : (
          // 'all' 탭은 classic, 'event' 탭은 event — 둘 다 TournamentList로 렌더
          <TournamentList
            tournaments={tournamentsData?.data}
            isLoading={isTournamentsLoading}
            onSelect={setSelectedTournament}
            emptyMessage={filter === 'event' ? tHome('eventComingSoon') : undefined}
          />
        )}
      </div>

      <TournamentSelectedModal
        isOpen={!!selectedTournament}
        onClose={() => setSelectedTournament(null)}
        tournament={selectedTournament}
      />

      <NetworkGate />
    </div>
  );
}
