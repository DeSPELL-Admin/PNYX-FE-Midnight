"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import TournamentGame from './_components/TournamentGame';
import { useTournaments } from '~/hooks';
import { useChainId } from '~/hooks/wallet';
import { Tournament } from '~/lib/api/types';
import { Spinner } from '~/components/ui/Spinner';

interface GameInstance {
    id: string;
    key: string; // Unique key for React rendering
    totalRound?: number;
}

export default function TournamentFeedPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialId = (params.id as string) || '1';
    const initialRound = searchParams.get('round') ? parseInt(searchParams.get('round') as string) : undefined;

    // Games feed state
    // Start with the requested game, ensuring totalRound is passed only if present
    const [games, setGames] = useState<GameInstance[]>([{
        id: initialId,
        key: `game-${initialId}-${Date.now()}`,
        totalRound: initialRound
    }]);
    const [activeGameId, setActiveGameId] = useState<string>(initialId);

    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    const chainId = useChainId();
    const { data: tournamentsData, isLoading: isTournamentsLoading } = useTournaments(chainId);

    const availableTournaments = useMemo(() => {
        return tournamentsData?.data || [];
    }, [tournamentsData]);

    const [cursor, setCursor] = useState(0);

    // Load next game logic
    const loadNextGame = useCallback(() => {
        if (!availableTournaments.length) return;

        setGames(prev => {
            // Find a tournament that hasn't been played yet or just pick random/next
            // Simple logic: pick next in list wrapping around, but ensuring we don't pick active or immediate duplicates if possible.
            // For infinite feed, we might just cycle through available ones.

            // Current implementation: Just pick random from available for variety, or sequential.
            // Let's go sequential based on a cursor? Or just random.
            // Random might be better for "Shorts" feel if list is long.

            const nextCandidate = availableTournaments[Math.floor(Math.random() * availableTournaments.length)];
            const randomId = nextCandidate.tournamentId; // Use real ID

            // Prevent duplicate adjacent? 
            if (prev.length > 0 && prev[prev.length - 1].id === String(randomId)) {
                // Try one more time or just accept
                return prev;
            }

            return [...prev, { id: String(randomId), key: `game-${randomId}-${Date.now()}` }];
        });
    }, [availableTournaments]);

    // Initial load of items if needed? 
    // Actually the page starts with initialId.
    // We don't need to force load next game immediately unless we want to buffer.

    // Observer for Active Game detection & Infinite Scroll
    useEffect(() => {
        if (!containerRef.current) return;

        // Cleanup previous observer
        if (observerRef.current) observerRef.current.disconnect();

        const options = {
            root: containerRef.current,
            threshold: 0.6 // Game is "active" when 60% visible
        };

        const callback: IntersectionObserverCallback = (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const gameId = entry.target.getAttribute('data-game-id');
                    if (gameId && gameId !== activeGameId) {
                        setActiveGameId(gameId);

                        // Silent URL update
                        window.history.replaceState(null, '', `/tournament/${gameId}`);
                    }

                    // Check if it's the last game, if so, load more
                    const isLast = entry.target.getAttribute('data-is-last') === 'true';
                    if (isLast) {
                        loadNextGame();
                    }
                }
            });
        };

        observerRef.current = new IntersectionObserver(callback, options);

        // Observe all game elements
        const gameElements = containerRef.current.querySelectorAll('.worldcup-game-wrapper');
        gameElements.forEach(el => observerRef.current?.observe(el));

        return () => observerRef.current?.disconnect();
    }, [games, activeGameId, loadNextGame]);


    return (
        <div
            ref={containerRef}
            className="h-[calc(100vh-140px)] w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
        >
            {games.map((game, index) => (
                <div
                    key={game.key}
                    className="worldcup-game-wrapper h-full w-full snap-start snap-always"
                    data-game-id={game.id}
                    data-is-last={index === games.length - 1}
                >
                    <TournamentGame
                        gameId={game.id}
                        isActive={activeGameId === game.id}
                        totalRound={game.totalRound}
                    />
                </div>
            ))}

            {/* Loading Indicator at bottom (visible when scrolling fast) */}
            <div className={`h-20 w-full flex items-center justify-center snap-start ${activeGameId ? '' : 'hidden'}`}>
                <Spinner className="text-gray-400" />
            </div>
        </div>
    );
}
