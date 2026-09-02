/**
 * Midnight 로그인 메시지 빌더.
 *
 * Lace 는 `signData(text, { keyType: 'unshielded' })` 로 임의 텍스트에 서명하므로 사람이 읽을 수 있는
 * 구조화된 메시지 포맷을 만든다. BE(`/auth/midnight/verify`)는 아래 필드를
 * 엄격 대조한다: domain === host, uri === origin, nonce, address, chainId, issuedAt(5분 이내).
 */

export interface BuildMidnightAuthMessageParams {
  address: string;      // mn_addr_… (unshielded)
  chainId: number;      // 합성 Midnight chainId
  nonce: string;
  statement: string | null;
}

export function buildMidnightAuthMessage({ address, chainId, nonce, statement }: BuildMidnightAuthMessageParams): string {
  if (typeof window === 'undefined') {
    throw new Error('buildMidnightAuthMessage 는 브라우저(client) 환경에서만 호출할 수 있습니다.');
  }
  const lines = [
    `${window.location.host} wants you to sign in with your Midnight account:`,
    address,
    '',
  ];
  if (statement) lines.push(statement, '');
  lines.push(
    `URI: ${window.location.origin}`,
    'Version: 1',
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  );
  return lines.join('\n');
}
