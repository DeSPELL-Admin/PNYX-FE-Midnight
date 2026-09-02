/**
 * 구매한 데이터셋(봉인된 브라켓)의 로컬 분석 모듈 — 순수 함수만. React·WASM·네트워크 없음.
 *
 * 브라켓 표현은 LWA(`src/lib/worldcup/lwa.ts`)의 최종 배열과 동일하다.
 * `submitMatchResult` 가 매 매치마다 `winnerBlock.concat(loserBlock)` 으로 병합하므로
 * 길이 n(16/32/64)의 최종 배열은 재귀적으로 `arr = winnerBlock ++ loserBlock` 구조를 갖는다.
 * 따라서 `arr[0]` 이 우승자이고, 블록을 반으로 쪼개 내려가며 모든 매치를 복원할 수 있다.
 *
 * 이 모듈이 다루는 값은 전부 온체인 커밋(voteCommitment)에 봉인된 itemId·bracket 뿐이므로
 * 여기서 계산된 통계는 "검증된 입력에서 브라우저가 직접 유도한 값"이다 — 체인은 집계를 공개하지 않는다.
 */

/** 브라켓에서 복원한 단일 매치. */
export interface Match {
  winner: number;
  loser: number;
  /**
   * 이 매치를 담고 있는 블록의 길이. 참가자 수 = 2n/size.
   * size === n → 결승, n/2 → 4강, n/4 → 8강, … , 2 → 첫 라운드(Round of n).
   */
  size: number;
}

/** analyze() 가 필요로 하는 로우의 최소 형태(데이터셋 v1/v2 공통). */
export interface AnalyzedRow {
  itemId: number;
  bracket: number[];
}

export interface ChampionShare {
  itemId: number;
  count: number;
  /** 0..100 */
  pct: number;
}

export interface WinRate {
  itemId: number;
  wins: number;
  played: number;
  /** 0..100 */
  pct: number;
}

export interface HeadToHeadCell {
  w: number;
  l: number;
}

export interface CommonFinal {
  /** 상대 전적에서 앞선 쪽(동률이면 작은 itemId). */
  a: number;
  b: number;
  count: number;
  /** `a` 가 결승에서 이긴 횟수. */
  aWins: number;
}

export interface RoundReach {
  itemId: number;
  /**
   * 라운드 참가자 수 → 그 라운드에 도달한 횟수. 예: 2=결승, 4=4강, 8=8강.
   *
   * 로우마다 브라켓 길이(16/32/64)가 다를 수 있으므로 블록 길이가 아니라 참가자 수를 키로 쓴다.
   * 블록 길이 16 은 16강 브라켓에서는 결승이지만 32강 브라켓에서는 4강이라 섞이면 어긋난다.
   */
  reached: Record<number, number>;
  /** 우승 횟수. */
  won: number;
}

export interface Analytics {
  /** 로우(=투표) 수. */
  votes: number;
  /** 모든 로우의 매치 수 합계. */
  matchesTotal: number;
  championShare: ChampionShare[];
  winRate: WinRate[];
  /** 실제로 맞붙은 쌍만 담긴다. headToHead.get(a)?.get(b) = a 기준 전적. */
  headToHead: Map<number, Map<number, HeadToHeadCell>>;
  commonFinals: CommonFinal[];
  roundReach: RoundReach[];
}

/** 길이가 2 이상의 2의 거듭제곱인지. */
export function isValidBracket(bracket: readonly number[]): boolean {
  const n = bracket.length;
  return n >= 2 && (n & (n - 1)) === 0;
}

/**
 * 봉인된 최종 배열에서 모든 매치를 복원한다.
 * `matches(arr) = [...matches(왼쪽 절반), ...matches(오른쪽 절반), {arr[0] 승, arr[half] 패}]`.
 * 유효하지 않은 길이(2의 거듭제곱이 아님)면 빈 배열 — UI 가 크래시 대신 빈 상태를 보이도록 한다.
 */
export function decodeMatches(bracket: number[]): Match[] {
  if (!isValidBracket(bracket)) return [];

  const out: Match[] = [];
  const walk = (start: number, len: number) => {
    if (len <= 1) return;
    const half = len / 2;
    walk(start, half);
    walk(start + half, half);
    out.push({ winner: bracket[start], loser: bracket[start + half], size: len });
  };
  walk(0, bracket.length);
  return out;
}

/** 블록 길이(size)가 나타내는 라운드의 참가자 수. */
export function roundParticipants(size: number, n: number): number {
  return (2 * n) / size;
}

/** 라운드 이름(영문 기본값). UI 는 참가자 수로 next-intl 키를 고르고, 이 값은 폴백으로 쓴다. */
export function roundLabel(size: number, n: number): string {
  const participants = roundParticipants(size, n);
  if (participants === 2) return 'Final';
  if (participants === 4) return 'Semis';
  if (participants === 8) return 'Quarters';
  return `Round of ${participants}`;
}

/**
 * 라운드별 "그 라운드에 오른 아이템 목록"을 첫 라운드(전원 n명)부터 우승자 1명까지 순서대로.
 *
 * 깊이 d 의 블록 머리(head)는 그 서브 브라켓의 승자다. 블록 길이 1 → 첫 라운드 대진 순서 전원,
 * 블록 길이 2 → 첫 라운드 승자 n/2명, … , 블록 길이 n → 우승자 1명.
 * 즉 `rounds[i]` 가 한 라운드의 참가자이고 `rounds[i + 1]` 이 그 라운드의 승자다.
 */
export function bracketRounds(bracket: number[]): number[][] {
  if (!isValidBracket(bracket)) return bracket.length === 1 ? [[bracket[0]]] : [];

  const n = bracket.length;
  const rounds: number[][] = [];
  for (let blockLen = 1; blockLen <= n; blockLen *= 2) {
    const heads: number[] = [];
    for (let i = 0; i < n; i += blockLen) heads.push(bracket[i]);
    rounds.push(heads);
  }
  return rounds;
}

function bumpHeadToHead(
  hh: Map<number, Map<number, HeadToHeadCell>>,
  self: number,
  other: number,
  field: 'w' | 'l',
) {
  let row = hh.get(self);
  if (!row) {
    row = new Map<number, HeadToHeadCell>();
    hh.set(self, row);
  }
  const cell = row.get(other) ?? { w: 0, l: 0 };
  cell[field] += 1;
  row.set(other, cell);
}

/** `participants` 는 라운드 참가자 수(2=결승, 4=4강, …) — 브라켓 길이와 무관한 키다. */
function bumpReach(reach: Map<number, Map<number, number>>, itemId: number, participants: number) {
  let row = reach.get(itemId);
  if (!row) {
    row = new Map<number, number>();
    reach.set(itemId, row);
  }
  row.set(participants, (row.get(participants) ?? 0) + 1);
}

/**
 * 데이터셋 로우 전체를 브라우저에서 집계한다. 정렬은 모두 내림차순(동률은 itemId 오름차순).
 *
 * 한 데이터셋 안에 16/32/64 브라켓이 섞여 있어도 안전하다 — 로우마다 자기 길이 n 으로
 * 매치를 복원하고, 라운드 집계는 블록 길이가 아니라 참가자 수(2/4/8/…)로 정규화한다.
 */
export function analyze(rows: AnalyzedRow[]): Analytics {
  const championCount = new Map<number, number>();
  const wins = new Map<number, number>();
  const played = new Map<number, number>();
  const headToHead = new Map<number, Map<number, HeadToHeadCell>>();
  const reach = new Map<number, Map<number, number>>();
  // 결승 대진은 정렬된 쌍("작은id-큰id")으로 모으고, 출력 시 전적이 앞선 쪽을 a 로 둔다.
  const finals = new Map<string, { lo: number; hi: number; loWins: number; hiWins: number; count: number }>();

  let matchesTotal = 0;

  for (const row of rows) {
    const n = row.bracket.length;
    const champion = n > 0 ? row.bracket[0] : row.itemId;
    championCount.set(champion, (championCount.get(champion) ?? 0) + 1);

    const matches = decodeMatches(row.bracket);
    matchesTotal += matches.length;

    for (const m of matches) {
      wins.set(m.winner, (wins.get(m.winner) ?? 0) + 1);
      played.set(m.winner, (played.get(m.winner) ?? 0) + 1);
      played.set(m.loser, (played.get(m.loser) ?? 0) + 1);

      bumpHeadToHead(headToHead, m.winner, m.loser, 'w');
      bumpHeadToHead(headToHead, m.loser, m.winner, 'l');

      const participants = roundParticipants(m.size, n);
      bumpReach(reach, m.winner, participants);
      bumpReach(reach, m.loser, participants);

      // size === n 인 매치가 그 로우의 결승이다.
      if (m.size === n) {
        const lo = Math.min(m.winner, m.loser);
        const hi = Math.max(m.winner, m.loser);
        const key = `${lo}-${hi}`;
        const agg = finals.get(key) ?? { lo, hi, loWins: 0, hiWins: 0, count: 0 };
        agg.count += 1;
        if (m.winner === lo) agg.loWins += 1;
        else agg.hiWins += 1;
        finals.set(key, agg);
      }
    }
  }

  const votes = rows.length;

  const championShare: ChampionShare[] = [...championCount.entries()]
    .map(([itemId, count]) => ({ itemId, count, pct: votes > 0 ? (count / votes) * 100 : 0 }))
    .sort((x, y) => y.count - x.count || x.itemId - y.itemId);

  const winRate: WinRate[] = [...played.entries()]
    .map(([itemId, p]) => {
      const w = wins.get(itemId) ?? 0;
      return { itemId, wins: w, played: p, pct: p > 0 ? (w / p) * 100 : 0 };
    })
    .sort((x, y) => y.pct - x.pct || y.played - x.played || x.itemId - y.itemId);

  const commonFinals: CommonFinal[] = [...finals.values()]
    .map(({ lo, hi, loWins, hiWins, count }) =>
      loWins >= hiWins
        ? { a: lo, b: hi, count, aWins: loWins }
        : { a: hi, b: lo, count, aWins: hiWins },
    )
    .sort((x, y) => y.count - x.count || y.aWins - x.aWins || x.a - y.a);

  const roundReach: RoundReach[] = [...reach.entries()]
    .map(([itemId, sizes]) => ({
      itemId,
      reached: Object.fromEntries(sizes) as Record<number, number>,
      won: championCount.get(itemId) ?? 0,
    }))
    .sort(
      (x, y) =>
        y.won - x.won ||
        (played.get(y.itemId) ?? 0) - (played.get(x.itemId) ?? 0) ||
        x.itemId - y.itemId,
    );

  return { votes, matchesTotal, championShare, winRate, headToHead, commonFinals, roundReach };
}
