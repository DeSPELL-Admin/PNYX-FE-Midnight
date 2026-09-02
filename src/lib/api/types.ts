/**
 * API 타입 정의
 *
 * 프론트엔드와 백엔드 간 공유되는 타입들
 * 백엔드 분리 시 이 파일을 공유 패키지로 이동 가능
 */

// ============================================
// 공통 응답 타입
// ============================================

// ============================================
// 공통 응답 타입
// ============================================

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Meta {
  timestamp: string;
  [key: string]: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: Pagination;
  meta?: Meta;
  error?: string;
}

// 페이지네이션된 목록 응답을 위한 유틸리티 타입
export type PaginatedApiResponse<T> = ApiResponse<T[]> & { pagination: Pagination };

/**
 * @deprecated Use PaginatedApiResponse<T> instead
 * 기존 코드 호환성을 위해 남겨둠, 점진적으로 교체 필요
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ============================================
// 카테고리 관련 타입
// ============================================

export interface Category {
  category : string;
}

// ============================================
// 토너먼트 관련 타입
// ============================================

/**
 * 토너먼트 타입 필터.
 * BE enum 과 정확히 동일한 케이싱(`'event' | 'classic'`)을 사용한다(기본 `'classic'`).
 */
export type TournamentType = 'event' | 'classic';

/**
 * 로그인 유저의 토너먼트 완료 상태.
 * 신규 BE 리스트 응답이 서버측에서 계산해 내려준다.
 */
export type TournamentStatus = 'incomplete' | 'completed';

export interface Tournament {
  category?: string;
  tournamentId: number;
  title: string;
  selectedCount: number;
  txHash?: string;
  firstItemImageName: string;
  secondItemImageName: string;
  // 신규 BE 리스트 응답에만 포함되는 필드 — 옵셔널이라 기존 소비측은 영향 없음.
  status?: TournamentStatus;
  type?: TournamentType;
}

export interface TournamentRandomItemIds {
  randomItemIds: number[];
}

export interface TournamentItem {
  name: string;
  imageName: string;
}

export interface TournamentItemStat {
  itemId: number;
  name: string;
  imageName: string;
  firstRate: number;
  winRate: number;
}

export interface TournamentItemOpponentStat {
  opponentItemId: number;
  opponentItemName: string;
  opponentItemImageName: string;
  winRate: number;
}

// ============================================
// 유저 - 토너먼트 관련 타입
// ============================================

export interface UserTournamentPlayDetail {
 firstItemId: number;
 secondItemId: number;
 entryItemHexex: string;
 txHash: string;
}

/**
 * `GET /me` 응답 — 인증된 지갑 주소의 보유 포인트.
 * (Phase 5 포인트 실연동 에이전트가 소비. 미리 정의해도 무해.)
 */
export interface MyPoint {
  point: number;
}


// ============================================
// 게임/토너먼트 진행 관련 공통 타입
// ============================================

export type GameStatus = 'idle' | 'loading' | 'playing' | 'finished' | 'error';

export interface Candidate {
  id: string;
  name: string;
  imageName: string;
  imageUrl: string;
}

export interface RoundInfo {
  round: number; // 16, 8, 4, 2 (Final)
  currentMatchIndex: number;
  totalMatches: number;
  leftCandidate: Candidate;
  rightCandidate: Candidate;
  // Optional UI helpers
  progress?: number;
  roundTitle?: string;
}
