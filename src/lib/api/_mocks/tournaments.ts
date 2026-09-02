import type {
  ApiResponse,
  PaginatedApiResponse,
  Tournament,
  TournamentItem,
  TournamentItemOpponentStat,
  TournamentItemStat,
  TournamentRandomItemIds,
} from '../types';

export const MOCK_TOURNAMENTS: Tournament[] = [
  {
    tournamentId: 1,
    title: 'Best Web3 dApp 2026',
    selectedCount: 1240,
    firstItemImageName: 'mock-1',
    secondItemImageName: 'mock-2',
    category: 'Tech',
  },
  {
    tournamentId: 2,
    title: 'Favorite NFT Collection',
    selectedCount: 892,
    firstItemImageName: 'mock-3',
    secondItemImageName: 'mock-4',
    category: 'NFT',
  },
  {
    tournamentId: 3,
    title: 'Top Anime Character of the Year',
    selectedCount: 2310,
    firstItemImageName: 'mock-5',
    secondItemImageName: 'mock-6',
    category: 'Entertainment',
  },
  {
    tournamentId: 4,
    title: 'K-Pop Group World Cup',
    selectedCount: 4502,
    firstItemImageName: 'mock-7',
    secondItemImageName: 'mock-8',
    category: 'Music',
  },
  {
    tournamentId: 5,
    title: 'Best Coffee Brand',
    selectedCount: 311,
    firstItemImageName: 'mock-9',
    secondItemImageName: 'mock-10',
    category: 'Food',
  },
];

const MOCK_ITEM_POOL_SIZE = 64;

const ok = <T>(data: T): ApiResponse<T> => ({ success: true, data });

export function paginate<T>(
  items: T[],
  page: number,
  limit: number,
): PaginatedApiResponse<T> {
  const start = (page - 1) * limit;
  const slice = items.slice(start, start + limit);
  return {
    success: true,
    data: slice,
    pagination: {
      page,
      limit,
      total: items.length,
      totalPages: Math.max(1, Math.ceil(items.length / limit)),
      hasNext: start + limit < items.length,
      hasPrev: page > 1,
    },
  };
}

const mockImageName = (itemId: number) => `mock-${((itemId - 1) % 10) + 1}`;

export function mockGetTournaments(
  _chainId: number,
  page: number,
  limit: number,
  orderBy: 'POPULARITY' | 'LATEST',
): Promise<PaginatedApiResponse<Tournament>> {
  const sorted =
    orderBy === 'LATEST'
      ? [...MOCK_TOURNAMENTS].sort((a, b) => b.tournamentId - a.tournamentId)
      : [...MOCK_TOURNAMENTS].sort((a, b) => b.selectedCount - a.selectedCount);
  return Promise.resolve(paginate(sorted, page, limit));
}

export function mockGetTournament(
  _chainId: number,
  tournamentId: number,
): Promise<ApiResponse<Tournament>> {
  const found = MOCK_TOURNAMENTS.find((t) => t.tournamentId === tournamentId);
  const tournament: Tournament =
    found ?? {
      tournamentId,
      title: `Mock Tournament ${tournamentId}`,
      selectedCount: 0,
      firstItemImageName: mockImageName(1),
      secondItemImageName: mockImageName(2),
      category: 'Other',
    };
  return Promise.resolve(ok(tournament));
}

export function mockGetTournamentsRandomItems(
  _chainId: number,
  _tournamentId: number,
  roundCount: number,
): Promise<ApiResponse<TournamentRandomItemIds>> {
  const ids = Array.from({ length: roundCount }, (_, i) => i + 1);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return Promise.resolve(ok({ randomItemIds: ids }));
}

export function mockGetTournamentItemById(
  _chainId: number,
  _tournamentId: number,
  itemId: number,
): Promise<ApiResponse<TournamentItem>> {
  return Promise.resolve(
    ok({
      name: `Mock Item ${itemId}`,
      imageName: mockImageName(itemId),
    }),
  );
}

const buildMockItemStats = (count: number): TournamentItemStat[] =>
  Array.from({ length: count }, (_, i) => {
    const itemId = i + 1;
    const rate = Math.round(((count - i) / count) * 100) / 100;
    return {
      itemId,
      name: `Mock Item ${itemId}`,
      imageName: mockImageName(itemId),
      firstRate: rate,
      winRate: rate,
    };
  });

export function mockGetTournamentStats(
  _chainId: number,
  _tournamentId: number,
  page: number = 1,
  limit: number = 10,
): Promise<PaginatedApiResponse<TournamentItemStat>> {
  const all = buildMockItemStats(MOCK_ITEM_POOL_SIZE);
  return Promise.resolve(paginate(all, page, limit));
}

export function mockGetTournamentItemStatsById(
  _chainId: number,
  _tournamentId: number,
  itemId: number,
  page: number = 1,
  limit: number = 10,
): Promise<PaginatedApiResponse<TournamentItemOpponentStat>> {
  const opponents: TournamentItemOpponentStat[] = Array.from(
    { length: MOCK_ITEM_POOL_SIZE },
    (_, i) => i + 1,
  )
    .filter((id) => id !== itemId)
    .map((id) => ({
      opponentItemId: id,
      opponentItemName: `Mock Item ${id}`,
      opponentItemImageName: mockImageName(id),
      winRate: Math.round(Math.random() * 100) / 100,
    }));
  return Promise.resolve(paginate(opponents, page, limit));
}
