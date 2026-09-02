"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';
import { GameStatus } from '~/lib/api/types';

interface TournamentContextType {
    gameStatus: GameStatus;
    activeTournamentId: number | null;
    // 실제 플레이 인스턴스(TournamentGame)가 자신의 게임 상태를 컨텍스트에 동기화한다.
    syncExternalGame: (tournamentId: number, status: GameStatus) => void;
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined);

export function TournamentProvider({ children }: { children: React.ReactNode }) {
    // 게임 로직은 플레이 화면(TournamentGame)의 useGameLogic 인스턴스가 단독으로 구동한다.
    // 컨텍스트는 라우트 간 내비게이션(진행 중 토너먼트 딥링크/리다이렉트)을 위해
    // "활성 토너먼트 id + 그 상태"만 보관한다. (과거엔 여기서 useGameLogic 을 한 번 더
    // 호출해 동일 게임을 이중 구동 → 중복 fetch 가 발생했다.)
    const [activeTournamentId, setActiveTournamentId] = useState<number | null>(null);
    const [activeGameStatus, setActiveGameStatus] = useState<GameStatus>('idle');

    const gameStatus: GameStatus = activeTournamentId === null ? 'idle' : activeGameStatus;

    const syncExternalGame = useCallback((tournamentId: number, status: GameStatus) => {
        setActiveTournamentId((prev) => (prev !== tournamentId ? tournamentId : prev));
        setActiveGameStatus(status);
    }, []);

    return (
        <TournamentContext.Provider value={{
            gameStatus,
            activeTournamentId,
            syncExternalGame,
        }}>
            {children}
        </TournamentContext.Provider>
    );
}

export function useTournament() {
    const context = useContext(TournamentContext);
    if (context === undefined) {
        throw new Error('useTournament must be used within a TournamentProvider');
    }
    return context;
}
