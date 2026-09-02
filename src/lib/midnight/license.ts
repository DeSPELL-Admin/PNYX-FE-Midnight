/**
 * 지갑 없이 온체인 라이선스/커밋을 조회한다 (검증 패널의 데이터 소스).
 *
 * `setNetworkId()` 를 반드시 인덱서 프로바이더 생성보다 먼저 호출해야 한다(주소 인코딩/tx 조립이
 * 전역 네트워크 설정을 요구함 — providers.ts 와 동일 제약). 모든 midnight 패키지·컴파일된 컨트랙트
 * import 는 함수 내부에서 동적으로 로드한다(WASM, 서버 컴포넌트 오염 방지).
 */

import { fromHex, pad32, toHex } from './userKeys';
import { sha256Hex } from '../crypto/sha256';
import { MIDNIGHT_INDEXER_URL, MIDNIGHT_INDEXER_WS_URL, MIDNIGHT_NETWORK_ID, TOURNAMENT_FINALIZER_ADDRESS } from './config';

export interface OnChainLicense {
  tournamentId: number;
  rowCount: number;
  sampleAtSale: number;
  datasetHash: string;
  commitDigest: string;
  querySpecHash: string;
  buyerPk: string;
}

/**
 * 네트워크 id 를 고정하고 TournamentFinalizer 의 최신 ledger 를 인덱서에서 읽는다.
 * (1) setNetworkId 먼저 → (2) indexerPublicDataProvider → (3) queryContractState → TF.ledger(state.data).
 */
async function loadLedger() {
  const { setNetworkId } = await import('@midnight-ntwrk/midnight-js-network-id');
  setNetworkId(MIDNIGHT_NETWORK_ID);

  const [{ indexerPublicDataProvider }, TF] = await Promise.all([
    import('@midnight-ntwrk/midnight-js-indexer-public-data-provider'),
    import('~/midnight/contract/TournamentFinalizer/index.js'),
  ]);

  if (!TOURNAMENT_FINALIZER_ADDRESS) {
    throw new Error('NEXT_PUBLIC_CONTRACT_TOURNAMENT_FINALIZER_MIDNIGHT is not set');
  }
  const provider = indexerPublicDataProvider(MIDNIGHT_INDEXER_URL, MIDNIGHT_INDEXER_WS_URL);
  const state = await provider.queryContractState(TOURNAMENT_FINALIZER_ADDRESS);
  if (!state) throw new Error('TournamentFinalizer contract state not found on indexer');
  return { ledger: TF.ledger(state.data), TF };
}

/** buyerPk/tournamentId/querySpec 으로 licenseId 를 계산해 License 를 조회한다. 없으면 null. */
export async function fetchLicense(args: {
  buyerPkHex: string;
  tournamentId: number;
  querySpec: string;
}): Promise<OnChainLicense | null> {
  const { ledger, TF } = await loadLedger();
  const specHash = await sha256Hex(args.querySpec);
  const licenseId = TF.pureCircuits.licenseId(fromHex(args.buyerPkHex), BigInt(args.tournamentId), fromHex(specHash));
  if (!ledger.licenses.member(licenseId)) return null;

  const lic = ledger.licenses.lookup(licenseId);
  return {
    tournamentId: Number(lic.tournamentId),
    rowCount: Number(lic.rowCount),
    sampleAtSale: Number(lic.sampleAtSale),
    datasetHash: toHex(lic.datasetHash),
    commitDigest: toHex(lic.commitDigest),
    querySpecHash: toHex(lic.querySpecHash),
    buyerPk: toHex(lic.buyerPk),
  };
}

/** 토너먼트의 현재 sampleCount(투표 수) — 판매 시점 sampleAtSale 과 대조해 FULL/PARTIAL 표시용. */
export async function fetchSampleCount(tournamentId: number): Promise<number> {
  const { ledger } = await loadLedger();
  const key = BigInt(tournamentId);
  if (!ledger.sampleCount.member(key)) return 0;
  return Number(ledger.sampleCount.lookup(key).read());
}

/**
 * 로우별 voteCommitment 를 재계산해 voteCommits 머클트리에 실제로 존재하는지 검증한다.
 * B안(브라켓 완전 봉인) — VoteRow 가 브라켓 전체 대신 `bracketHash` 만 담으므로, 검증 측이
 * 로우의 `bracket` 을 받아 길이(16/32/64)에 맞는 `pureCircuits.bracketHash{16|32|64}` 로
 * 재계산한 뒤 voteCommitment 에 넣어야 커밋이 로우+브라켓 전체를 봉인했음을 확인할 수 있다.
 */
export async function checkRowCommit(row: {
  tournamentId: number;
  itemId: number;
  segment: string;
  salt: string;
  bracket: number[];
}): Promise<boolean> {
  const { ledger, TF } = await loadLedger();
  const bracket = row.bracket.map((n) => BigInt(n));
  let bracketHash: Uint8Array;
  switch (row.bracket.length) {
    case 16: bracketHash = TF.pureCircuits.bracketHash16(bracket); break;
    case 32: bracketHash = TF.pureCircuits.bracketHash32(bracket); break;
    case 64: bracketHash = TF.pureCircuits.bracketHash64(bracket); break;
    default: throw new Error(`checkRowCommit: unsupported bracket length ${row.bracket.length} (16/32/64 only)`);
  }
  const leaf = TF.pureCircuits.voteCommitment(
    { tournamentId: BigInt(row.tournamentId), itemId: BigInt(row.itemId), bracketHash, segment: pad32(row.segment) },
    fromHex(row.salt),
  );
  return ledger.voteCommits.findPathForLeaf(leaf) !== undefined;
}
