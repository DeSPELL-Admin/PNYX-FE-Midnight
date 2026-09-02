/**
 * 마켓 가격 표시 — priceUnits(최소 단위 문자열) → tNIGHT 표시 문자열.
 * 1 tNIGHT = 1e6 최소 단위(units). 소수부가 0이면 정수로만 표시한다.
 */
export function formatTNight(unitsRaw: string): string {
  let units: bigint;
  try {
    units = BigInt(unitsRaw);
  } catch {
    return unitsRaw;
  }
  const whole = units / 1_000_000n;
  const frac = units % 1_000_000n;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(6, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}
