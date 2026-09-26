/**
 * 구매한 데이터셋 파일의 정규형 + 파서 — 순수 모듈(React·WASM·네트워크 없음).
 *
 * v1: `{ v:1, tournamentId, orderId, rowCount, rows:[{ tournamentId, itemId, bracket, segment, salt }] }`
 * v2: 위에 더해 파일 레벨 `tournamentTitle`, 로우 레벨 `itemName` / `bracketNames`.
 *
 * 이름(itemName/bracketNames/tournamentTitle)은 **참고 정보**다 — 온체인 커밋에 봉인된 값은
 * itemId 와 bracket 뿐이므로, 이름이 틀려도 검증은 통과할 수 있다. UI 는 이 구분을 표시한다.
 * v1 파일은 이름 필드가 없으므로 구매자 전용 카탈로그(getOrderCatalog)로 이름을 채운다.
 */

export interface DatasetRow {
  tournamentId: number;
  itemId: number;
  /** LWA 최종 배열. 길이 16/32/64, [0] 이 우승자. */
  bracket: number[];
  segment: string;
  salt: string;
  /** v2 전용 — 우승 아이템 이름(참고 정보). */
  itemName?: string;
  /** v2 전용 — `bracket` 과 같은 순서의 이름 배열(참고 정보). */
  bracketNames?: string[];
}

export interface DatasetFile {
  v: number;
  tournamentId: number;
  /** v2 전용(참고 정보). */
  tournamentTitle?: string;
  orderId: string;
  rowCount: number;
  rows: DatasetRow[];
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value ?? 0) || 0;
}

function toStringField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** 서버가 준 바이트를 파싱하고 방어적으로 정규화한다. 형태가 어긋나면 throw. */
export function parseDataset(bytes: Uint8Array): DatasetFile {
  const raw = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  if (!raw || typeof raw !== 'object') throw new Error('dataset: not an object');

  const rawRows = Array.isArray(raw.rows) ? (raw.rows as Record<string, unknown>[]) : [];

  const rows: DatasetRow[] = rawRows.map((r) => {
    const bracket = Array.isArray(r.bracket) ? (r.bracket as unknown[]).map(toNumber) : [];
    const bracketNames = Array.isArray(r.bracketNames)
      ? (r.bracketNames as unknown[]).map(toStringField)
      : undefined;
    return {
      tournamentId: toNumber(r.tournamentId),
      itemId: toNumber(r.itemId),
      bracket,
      segment: toStringField(r.segment),
      salt: toStringField(r.salt),
      itemName: typeof r.itemName === 'string' ? r.itemName : undefined,
      bracketNames,
    };
  });

  return {
    v: toNumber(raw.v),
    tournamentId: toNumber(raw.tournamentId),
    tournamentTitle: typeof raw.tournamentTitle === 'string' ? raw.tournamentTitle : undefined,
    orderId: toStringField(raw.orderId),
    rowCount: typeof raw.rowCount === 'number' ? raw.rowCount : rows.length,
    rows,
  };
}

/**
 * 데이터셋 전체에서 itemId → 이름 맵을 만든다(v2 로우의 이름 필드만 사용).
 * v1 이면 빈 맵이 나오고, 호출부가 카탈로그로 폴백한다.
 */
export function namesFromRows(rows: DatasetRow[]): Map<number, string> {
  const names = new Map<number, string>();
  for (const row of rows) {
    if (row.itemName) names.set(row.itemId, row.itemName);
    if (row.bracketNames) {
      row.bracket.forEach((itemId, i) => {
        const name = row.bracketNames?.[i];
        if (name) names.set(itemId, name);
      });
    }
  }
  return names;
}
