'use client';

import { useTranslations } from 'next-intl';
import Card from '~/components/ui/Card';
import CardSkeleton from '~/components/ui/CardSkeleton';
import EmptyState from '~/components/ui/EmptyState';
import type { Tournament } from '~/lib/api/types';

interface Props {
  tournaments: Tournament[] | null | undefined;
  isLoading: boolean;
  onSelect: (t: Tournament) => void;
  skeletonCount?: number;
  /** 비어있을 때 표기할 메시지(미지정 시 기본 문구) */
  emptyMessage?: string;
}

export default function TournamentList({
  tournaments,
  isLoading,
  onSelect,
  skeletonCount = 3,
  emptyMessage,
}: Props) {
  const tHome = useTranslations('home');
  const tCommon = useTranslations('common');
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!tournaments || tournaments.length === 0) {
    return <EmptyState message={emptyMessage ?? tHome('noCompletedEvents')} hint={tCommon('comingSoon')} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {tournaments.map((t) => {
        // 완료 여부는 서버 응답의 status 필드로 판정(로그인 사용자 기준).
        // 기존 클라이언트측 completedIds Set 핵을 대체.
        const isCompleted = t.status === 'completed';
        return (
          <Card
            key={t.tournamentId}
            title={t.title}
            imageName1={t.firstItemImageName}
            imageName2={t.secondItemImageName}
            theme={t.category}
            badge={isCompleted ? tHome('badgeCompleted') : undefined}
            badgeVariant="green"
            onClick={() => onSelect(t)}
          />
        );
      })}
    </div>
  );
}
