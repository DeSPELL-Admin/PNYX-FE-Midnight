import type {
  PaginatedApiResponse,
  Tournament,
  UserTournamentPlayDetail,
} from '../types';
import { MOCK_TOURNAMENTS, paginate } from './tournaments';

export function mockGetUserTournaments(
  _chainId: number,
  _address: string,
  page: number = 1,
  limit: number = 10,
): Promise<PaginatedApiResponse<Tournament>> {
  return Promise.resolve(paginate(MOCK_TOURNAMENTS.slice(0, 3), page, limit));
}

export function mockGetUserTournamentPlayDetail(
  _chainId: number,
  _address: string,
  tournamentId: number,
): Promise<PaginatedApiResponse<UserTournamentPlayDetail>> {
  const all: UserTournamentPlayDetail[] = [
    {
      firstItemId: 1,
      secondItemId: 2,
      entryItemHexex: '0x01',
      txHash: `0xmock-${tournamentId}-a`,
    },
    {
      firstItemId: 3,
      secondItemId: 4,
      entryItemHexex: '0x02',
      txHash: `0xmock-${tournamentId}-b`,
    },
    {
      firstItemId: 5,
      secondItemId: 6,
      entryItemHexex: '0x03',
      txHash: `0xmock-${tournamentId}-c`,
    },
  ];
  return Promise.resolve(paginate(all, 1, 10));
}
