"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTournament } from '~/context/TournamentContext';
import Button from '~/components/ui/Button';
import Home from '~/assets/icons/home.svg'

export default function WorldcupGamePage() {
  const router = useRouter();
  const { gameStatus, activeTournamentId } = useTournament();

  // 진행 중인 토너먼트가 있으면 해당 게임 화면으로 리다이렉트
  useEffect(() => {
    if (activeTournamentId !== null && activeTournamentId !== undefined && activeTournamentId >= 0) {
      router.replace(`/tournament/${activeTournamentId}`);
    }
  }, [activeTournamentId, router]);

  // 진행 중인 게임이 없을 때
  if (gameStatus === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] px-4 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">No Active Game</h2>
        <p className="text-brand-primary-400 mb-8 max-w-[250px]">
          There is no tournament in progress. Go to Home to start a new one!
        </p>
        <Button
          variant="ctaBlack"
          className="w-full max-w-[200px] flex items-center justify-center gap-2"
          onClick={() => router.push('/')}
        >
          <Home />
          Go to Home
        </Button>
      </div>
    );
  }

  // 진행 중인 게임은 위 useEffect 가 /tournament/[id] 로 리다이렉트한다.
  return null;
}
