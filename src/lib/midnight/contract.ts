/**
 * TournamentFinalizer 컴파일 컨트랙트 핸들 + join.
 * Solidity 시절 `getContractAddress` + ABI 의 역할. 생성된 코드는 sync-contract.sh 가
 * `src/midnight/contract/TournamentFinalizer/` 에 넣는다.
 */

import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { findDeployedContract, type FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import * as TF from '~/midnight/contract/TournamentFinalizer/index.js';
import { witnesses, type TournamentFinalizerPrivateState } from '~/midnight/contract/TournamentFinalizer.witnesses';
import { TF_PRIVATE_STATE_ID, type TFProviders } from './providers';
import { TOURNAMENT_FINALIZER_ADDRESS } from './config';

export type TFContract = TF.Contract<TournamentFinalizerPrivateState>;
export type JoinedTF = FoundContract<TFContract>;

export const tournamentFinalizerCompiled = CompiledContract.make<TFContract>('TournamentFinalizer', TF.Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
);

export function requireContractAddress(): string {
  if (!TOURNAMENT_FINALIZER_ADDRESS) throw new Error('NEXT_PUBLIC_CONTRACT_TOURNAMENT_FINALIZER_MIDNIGHT is not set');
  return TOURNAMENT_FINALIZER_ADDRESS;
}

export async function joinTournamentFinalizer(
  providers: TFProviders,
  initialPrivateState: TournamentFinalizerPrivateState,
): Promise<JoinedTF> {
  return findDeployedContract<TFContract>(providers as never, {
    contractAddress: requireContractAddress(),
    compiledContract: tournamentFinalizerCompiled,
    privateStateId: TF_PRIVATE_STATE_ID,
    initialPrivateState,
  } as never) as Promise<JoinedTF>;
}

export { TF };
