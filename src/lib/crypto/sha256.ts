/**
 * SHA-256 (Web Crypto). 마켓 querySpec 해시(specHash)와 다운로드한 데이터셋 파일 검증(검증 패널)에 쓴다.
 * `crypto.subtle` 은 secure context(https/localhost) 전용 — 브라우저 클라이언트 코드에서만 호출한다.
 */
export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
