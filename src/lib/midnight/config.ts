/**
 * Midnight 네트워크/컨트랙트 설정 — 단일 진실원.
 *
 * 이전 `chains.ts` + `contract.ts` 역할을 합친다. Midnight 는 EVM 체인 id 가 없지만
 * BE 라우트(`/chains/:chainId/...`)와 로컬 저장 키(game-progress)가 숫자 chainId 를 쓰므로
 * 네트워크별 **합성 chainId** 를 둔다. BE 는 같은 상수로 매핑한다(PNYX-BE `MIDNIGHT_CHAIN_ID`).
 */

export type MidnightNetworkId = 'preprod' | 'preview' | 'undeployed';

export const MIDNIGHT_NETWORK_ID: MidnightNetworkId =
  (process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK as MidnightNetworkId | undefined) ?? 'preprod';

/** 합성 chainId — preprod 9_9101, preview 9_9102, standalone 9_9100 */
export const MIDNIGHT_CHAIN_IDS: Record<MidnightNetworkId, number> = {
  undeployed: 99100,
  preprod: 99101,
  preview: 99102,
};

export const MIDNIGHT_CHAIN_ID = MIDNIGHT_CHAIN_IDS[MIDNIGHT_NETWORK_ID];

export const MIDNIGHT_EXPLORER_URLS: Record<MidnightNetworkId, string | undefined> = {
  undeployed: undefined,
  preprod: 'https://preprod.midnight-explorer.io',
  preview: 'https://preview.midnight-explorer.io',
};

/** Lace 가 주입하는 DApp connector API 의 호환 버전 (`@midnight-ntwrk/dapp-connector-api` 4.x) */
export const COMPATIBLE_CONNECTOR_API_VERSION = '4.x';

/** 컴파일된 회로 자산(public/zk/<Name>/{keys,zkir}) 의 URL prefix. sync-contract.sh 가 채운다. */
export const ZK_CONFIG_BASE_URL = (name: 'TournamentFinalizer' | 'VotePointManager') =>
  `${typeof window !== 'undefined' ? window.location.origin : ''}/zk/${name}`;

/**
 * proof server 후보. 회로 증명은 witness(userSecret·voteSalt·bracket)를 proof server 에 보내 만든다 —
 * 즉 어느 서버를 고르느냐가 곧 "누가 내 비공개 입력을 보는가"다. 우선순위는
 * `proofServer.ts#resolveProofServer` 참고: 사용자 지갑에 설정된 서버 > env(PNYX 호스팅, 데모) > 로컬.
 */
export const ENV_PROOF_SERVER_URL: string | undefined = process.env.NEXT_PUBLIC_MIDNIGHT_PROOF_SERVER_URL || undefined;
export const LOCAL_PROOF_SERVER_URL = 'http://127.0.0.1:6300';

/**
 * Midnight 재단이 운영하는 공용 proof server(Lace 기본값). dApp 프루빙 요청을 403 으로 거부하므로
 * 지갑 설정이 이걸 가리키면 "설정 없음"으로 취급하고 다음 후보로 넘어간다. URL 로 파싱조차 안 되는
 * 값도 쓸 수 없으니 같은 취급.
 */
export function isPublicMidnightProofServer(url: string): boolean {
  try {
    return /^proof-server(\.[a-z0-9-]+)*\.midnight\.network$/i.test(new URL(url).hostname);
  } catch {
    return true;
  }
}

export const TOURNAMENT_FINALIZER_ADDRESS: string | undefined =
  process.env.NEXT_PUBLIC_CONTRACT_TOURNAMENT_FINALIZER_MIDNIGHT || undefined;

/**
 * 인덱서 URL — 컨트랙트 공개 상태(grant leaf, 라이선스/커밋) 조회는 지갑 유무와 무관하게 이걸 쓴다
 * (license.ts, providers.ts). 지갑이 알려주는 indexerUri 는 지갑/프로필마다 달라 같은 preprod 인데도
 * 우리 컨트랙트 상태가 안 보이는 일이 있었다(leaf 는 온체인에 있는데 FE 만 타임아웃). 기본값은 preprod 공식 인덱서.
 */
/**
 * 브라우저에선 같은 오리진의 프록시(next.config.ts rewrites → 공식 인덱서)를 쓴다 — 공식 인덱서는 브라우저
 * origin 에 CORS 헤더를 주지 않는다(특히 503 에러 페이지). env 로 직접 URL 을 주면 그걸 우선한다.
 */
export const MIDNIGHT_INDEXER_URL: string =
  process.env.NEXT_PUBLIC_MIDNIGHT_INDEXER_URL
  ?? (typeof window !== 'undefined'
    ? `${window.location.origin}/midnight-indexer/graphql`
    : 'https://indexer.preprod.midnight.network/api/v4/graphql');

export const MIDNIGHT_INDEXER_WS_URL: string =
  process.env.NEXT_PUBLIC_MIDNIGHT_INDEXER_WS_URL ?? 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws';
