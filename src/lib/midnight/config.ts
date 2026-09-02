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
 * 지갑 설정에 proof server 가 없을 때 쓰는 폴백. 데모에선 PNYX 가 호스팅한 proof server 를
 * 가리킨다(witness 는 브라우저에 남고 증명만 위임 — SPEC §7 참고).
 */
export const FALLBACK_PROOF_SERVER_URL =
  process.env.NEXT_PUBLIC_MIDNIGHT_PROOF_SERVER_URL ?? 'http://127.0.0.1:6300';

export const TOURNAMENT_FINALIZER_ADDRESS: string | undefined =
  process.env.NEXT_PUBLIC_CONTRACT_TOURNAMENT_FINALIZER_MIDNIGHT || undefined;

/**
 * 인덱서 URL — 지갑 없이(구매자 로그인 없이도) 온체인 라이선스/커밋을 조회할 때 쓴다(license.ts).
 * 지갑 연결 흐름은 providers.ts 처럼 `wallet.api.getConfiguration()` 의 indexerUri 를 우선 쓰고,
 * 이 상수는 그게 없는 조회 전용 경로의 기본값이다. 기본값은 preprod 공식 인덱서.
 */
export const MIDNIGHT_INDEXER_URL: string =
  process.env.NEXT_PUBLIC_MIDNIGHT_INDEXER_URL ?? 'https://indexer.preprod.midnight.network/api/v3/graphql';

export const MIDNIGHT_INDEXER_WS_URL: string =
  process.env.NEXT_PUBLIC_MIDNIGHT_INDEXER_WS_URL ?? 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws';
