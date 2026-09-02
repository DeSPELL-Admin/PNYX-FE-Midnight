'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAccount } from '~/hooks/wallet';
import Card from '~/components/ui/Card';
import EmptyState from '~/components/ui/EmptyState';
import { listGameProgress, type GameProgressSnapshot } from '~/lib/game-progress';

interface Props {
  chainId: number | undefined;
}

export default function InProgressTournamentList({ chainId }: Props) {
  const router = useRouter();
  const tHome = useTranslations('home');
  const tCommon = useTranslations('common');
  const { address } = useAccount();
  const [items, setItems] = useState<GameProgressSnapshot[] | null>(null);

  const badgeOf = (s: GameProgressSnapshot): string => {
    if (s.status === 'finished') return tHome('badgeResultReady');
    if (s.round === 2) return tHome('badgeFinal');
    return tHome('badgeRoundOf', { round: s.round });
  };

  useEffect(() => {
    if (!chainId || !address) {
      setItems([]);
      return;
    }
    // 진행 목록은 연결된 지갑 것만 — 다른 지갑의 진행이 보이지 않게 한다.
    setItems(listGameProgress(address, chainId));
  }, [chainId, address]);

  // 초기 클라이언트 렌더 전 (SSR/하이드레이션 깜빡임 방지)
  if (items === null) {
    return null;
  }

  if (items.length === 0) {
    return <EmptyState message={tHome('noInProgress')} hint={tCommon('playOneNow')} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((s) => (
        <Card
          key={`${s.chainId}-${s.tournamentId}`}
          title={s.title ?? tHome('tournamentFallback', { id: s.tournamentId })}
          imageName1={s.firstItemImageName ?? s.candidates[0]?.imageName ?? ''}
          imageName2={s.secondItemImageName ?? s.candidates[1]?.imageName ?? ''}
          badge={badgeOf(s)}
          onClick={() => router.push(`/tournament/${s.tournamentId}`)}
        />
      ))}
    </div>
  );
}
