import type { Candidate } from '~/lib/api/types';
import type { LWState } from '~/lib/worldcup/type';

const PREFIX = 'pnyx:game';
const MAX_ENTRIES = 10;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7일

export interface GameProgressSnapshot {
  version: 1;
  chainId: number;
  tournamentId: number;
  totalRound: number;
  status: 'playing' | 'finished';
  candidates: Candidate[];
  nextRoundCandidates: Candidate[];
  currentMatchIndex: number;
  round: number;
  winner: Candidate | null;
  lwState: LWState | null;
  // 진행 목록 카드 표시용 메타 (있으면 저장)
  title?: string;
  firstItemImageName?: string;
  secondItemImageName?: string;
  updatedAt: number;
}

// 진행 저장은 지갑 주소별로 분리한다 — 주소를 키에 넣지 않으면 다른 지갑으로 로그인해도
// 남의 진행 게임이 "이어하기" 목록에 보이고, 그걸 이어 finalize 하면 서버는 지갑별로
// playVerification 을 들고 있어 "No play verification found" 가 난다.
function keyOf(address: string, chainId: number, tournamentId: number): string {
  return `${PREFIX}:${address.toLowerCase()}:${chainId}:${tournamentId}`;
}

// ── 수동 타입 가드 (H9) ───────────────────────────────────────────────
// 손상된 localStorage 가 commitRound 등에서 throw → 게임 crash 하는 것을 막기 위해
// JSON.parse 직후 핵심 필드 구조를 검증한다. (zod 미사용, 수동 가드만)

function isCandidate(v: unknown): v is Candidate {
  if (typeof v !== 'object' || v === null) return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    typeof c.name === 'string' &&
    typeof c.imageName === 'string' &&
    typeof c.imageUrl === 'string'
  );
}

function isCandidateArray(v: unknown): v is Candidate[] {
  return Array.isArray(v) && v.every(isCandidate);
}

function isLwState(v: unknown): v is LWState {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  const isNumberMatrix = (m: unknown): boolean =>
    Array.isArray(m) && m.every((row) => Array.isArray(row) && row.every((x) => typeof x === 'number'));
  return (
    isNumberMatrix(s.groups) &&
    isNumberMatrix(s.next) &&
    typeof s.matchCursor === 'number'
  );
}

function isValidSnapshot(v: unknown): v is GameProgressSnapshot {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  if (s.version !== 1) return false;
  if (typeof s.round !== 'number') return false;
  if (typeof s.updatedAt !== 'number') return false;
  if (s.status !== 'playing' && s.status !== 'finished') return false;
  if (!isCandidateArray(s.candidates)) return false;
  if (!isCandidateArray(s.nextRoundCandidates)) return false;
  if (s.winner !== null && !isCandidate(s.winner)) return false;
  if (s.lwState !== null && !isLwState(s.lwState)) return false;
  return true;
}

// 이미지 URL은 재로딩 가능하므로 저장하지 않는다 (용량 절약)
function stripImages(list: Candidate[]): Candidate[] {
  return list.map((c) => ({ ...c, imageUrl: '' }));
}

export function saveGameProgress(address: string | undefined, snapshot: GameProgressSnapshot): void {
  if (typeof window === 'undefined') return;
  if (!address) return; // 지갑 미연결 시 저장하지 않는다(지갑별 스코프)
  try {
    const toStore: GameProgressSnapshot = {
      ...snapshot,
      candidates: stripImages(snapshot.candidates),
      nextRoundCandidates: stripImages(snapshot.nextRoundCandidates),
      winner: snapshot.winner ? { ...snapshot.winner, imageUrl: '' } : null,
      updatedAt: Date.now(),
    };
    localStorage.setItem(keyOf(address, snapshot.chainId, snapshot.tournamentId), JSON.stringify(toStore));
    pruneOldEntries();
  } catch (e) {
    console.warn('Failed to save game progress:', e);
  }
}

export function loadGameProgress(address: string | undefined, chainId: number, tournamentId: number): GameProgressSnapshot | null {
  if (typeof window === 'undefined') return null;
  if (!address) return null; // 지갑 미연결 시 복원 없음
  try {
    const raw = localStorage.getItem(keyOf(address, chainId, tournamentId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    // 구조 검증 실패(손상/구버전) 시 해당 항목 제거 후 null (H9)
    if (!isValidSnapshot(parsed)) {
      localStorage.removeItem(keyOf(address, chainId, tournamentId));
      return null;
    }
    if (Date.now() - parsed.updatedAt > MAX_AGE_MS) {
      localStorage.removeItem(keyOf(address, chainId, tournamentId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function removeGameProgress(address: string | undefined, chainId: number, tournamentId: number): void {
  if (typeof window === 'undefined') return;
  if (!address) return;
  try {
    localStorage.removeItem(keyOf(address, chainId, tournamentId));
  } catch {
    // noop
  }
}

export function listGameProgress(address: string | undefined, chainId: number): GameProgressSnapshot[] {
  if (typeof window === 'undefined') return [];
  if (!address) return []; // 지갑 미연결 시 빈 목록
  const out: GameProgressSnapshot[] = [];
  // 인덱스 순회 중 removeItem 하면 인덱스가 밀려 항목을 건너뛴다(M4).
  // 삭제 대상 키를 모은 뒤 순회 종료 후 일괄 삭제한다.
  const keysToRemove: string[] = [];
  try {
    const chainPrefix = `${PREFIX}:${address.toLowerCase()}:${chainId}:`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(chainPrefix)) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // 손상된 항목은 건너뜀
        continue;
      }
      if (!isValidSnapshot(parsed)) continue;
      if (Date.now() - parsed.updatedAt > MAX_AGE_MS) {
        keysToRemove.push(k);
        continue;
      }
      out.push(parsed);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // noop
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

// 전체 진행 항목 수를 MAX_ENTRIES로 제한 (오래된 것부터 제거)
function pruneOldEntries(): void {
  try {
    const entries: { key: string; updatedAt: number }[] = [];
    // 인덱스 순회 중 removeItem 하면 인덱스가 밀려 항목을 건너뛴다(M4).
    // 손상 항목 키를 모은 뒤 순회 종료 후 일괄 삭제한다.
    const corruptedKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(`${PREFIX}:`)) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as GameProgressSnapshot;
        entries.push({ key: k, updatedAt: parsed.updatedAt ?? 0 });
      } catch {
        corruptedKeys.push(k);
      }
    }
    corruptedKeys.forEach((k) => localStorage.removeItem(k));
    if (entries.length <= MAX_ENTRIES) return;
    entries.sort((a, b) => b.updatedAt - a.updatedAt);
    entries.slice(MAX_ENTRIES).forEach((e) => localStorage.removeItem(e.key));
  } catch {
    // noop
  }
}
