/**
 * 유저 프라이빗 키 자료 — `userSecret` / `voteSalt`.
 *
 * `userSecret` 은 지갑 주소마다 1개(결정적이면 좋지만 Lace 가 키 파생을 노출하지 않으므로
 * 최초 1회 랜덤 생성 후 localStorage 에 보관). 같은 브라우저에서만 재사용되므로, 다른 기기에서
 * 같은 지갑으로 접속하면 새 secret 이 생겨 "다른 유저"로 취급된다 — 해커톤 범위의 알려진 제약.
 * `voteSalt` 는 투표마다 새로 뽑고 escrow 위탁분에 포함된다 (모든 투표가 판매 대상).
 */

const SECRET_KEY = (address: string) => `pnyx:midnight:userSecret:${address}`;

const randomBytes32 = (): Uint8Array => {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return b;
};

export const toHex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
export const fromHex = (h: string): Uint8Array => {
  const clean = h.startsWith('0x') ? h.slice(2) : h;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
};

/** 주소별 userSecret — 없으면 생성해서 저장. client-only. */
export function getOrCreateUserSecret(address: string): Uint8Array {
  const key = SECRET_KEY(address);
  const existing = localStorage.getItem(key);
  if (existing) return fromHex(existing);
  const secret = randomBytes32();
  localStorage.setItem(key, toHex(secret));
  return secret;
}

export const newVoteSalt = (): Uint8Array => randomBytes32();

/** 로그아웃 시엔 지우지 않는다 — 지우면 같은 토너먼트에 다시 투표 가능해 보이지만 온체인 nullifier 는 이미 소비된 상태라 실패한다. */
export function clearUserSecret(address: string): void {
  localStorage.removeItem(SECRET_KEY(address));
}

/** Compact `pad(32, s)` 와 동일 — segment / spec 태그용 */
export function pad32(text: string): Uint8Array {
  const enc = new TextEncoder().encode(text);
  if (enc.length > 32) throw new Error(`pad32: "${text}" exceeds 32 bytes`);
  const out = new Uint8Array(32);
  out.set(enc, 0);
  return out;
}
