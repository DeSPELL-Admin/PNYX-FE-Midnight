import type { ItemId, LWState } from "./type";

//월드컵 초기 상태 생성
export function initState(initialIds: ItemId[]): LWState {
  const n = initialIds.length;
  if (n < 2 || (n & (n - 1)) !== 0) {
    throw new Error("initialIds length must be power of two >= 2");
  }

  for (const id of initialIds) {
    if (!Number.isInteger(id) || id < 0 || id > 10000) {
      throw new Error(`itemId out of range (0..10000): ${id}`);
    }
  }

  return {
    groups: initialIds.map((x) => [x]), // 핵심 초기화
    next: [],
    matchCursor: 0,
  };
}

//선택할 때마다 next 에 채우기
export function submitMatchResult(
  state: LWState,
  rightWon: boolean,
): LWState {
  const { groups, next, matchCursor } = state;

  if (groups.length <= 1) {
    throw new Error("Tournament already finished");
  }

  const i = matchCursor * 2;
  if (i + 1 >= groups.length) {
    throw new Error("Current round is complete. Commit the round.");
  }

  const leftBlock = groups[i];
  const rightBlock = groups[i + 1];

  // 승자 블록을 앞에 두어 병합
  const merged = rightWon
    ? rightBlock.concat(leftBlock)
    : leftBlock.concat(rightBlock);

  return {
    groups,
    next: [...next, merged],
    matchCursor: matchCursor + 1,
  };
}

//라운드 변경시 호출 groups = next
export function commitRound(state: LWState): LWState {
  const { groups, next, matchCursor } = state;

  if (groups.length <= 1) {
    throw new Error("Tournament already finished");
  }

  const expectedMatches = groups.length / 2;
  if (matchCursor !== expectedMatches) {
    throw new Error(
      `Round not complete: expected ${expectedMatches}, got ${matchCursor}`,
    );
  }

  return {
    groups: next,
    next: [],
    matchCursor: 0,
  };
}

//최종 LWA 조회
export function getFinalArray(state: LWState): ItemId[] {
  if (state.groups.length !== 1) {
    throw new Error("Tournament not finished yet");
  }
  return state.groups[0];
}

//Byte 변환
export function packFinalUint16BE(state: LWState): Uint8Array {
  const arr = getFinalArray(state);
  const out = new Uint8Array(arr.length * 2);

  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    out[i * 2] = (v >>> 8) & 0xff;
    out[i * 2 + 1] = v & 0xff;
  }
  return out;
}

export function packFinalHex(state: LWState): `0x${string}` {
  const bytes = packFinalUint16BE(state);
  let hex = "0x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex as `0x${string}`;
}
