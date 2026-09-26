import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Settlement = { user: Uint8Array;
                           tournamentId: bigint;
                           itemId: bigint;
                           amount: bigint;
                           option: Uint8Array
                         };

export type Witnesses<PS> = {
  userSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  grantPath(context: __compactRuntime.WitnessContext<Ledger, PS>,
            leaf_0: Uint8Array): [PS, { leaf: Uint8Array,
                                        path: { sibling: { field: bigint },
                                                goes_left: boolean
                                              }[]
                                      }];
}

export type ImpureCircuits<PS> = {
  grantSettle(context: __compactRuntime.CircuitContext<PS>, leaf_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  settle(context: __compactRuntime.CircuitContext<PS>,
         _tournamentId_0: bigint,
         _itemId_0: bigint,
         _amount_0: bigint,
         _option_0: Uint8Array,
         _deadline_0: bigint,
         _nonce_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  setVoteSigner(context: __compactRuntime.CircuitContext<PS>,
                _voteSigner_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  setDomainTag(context: __compactRuntime.CircuitContext<PS>,
               _domainTag_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  grantSettle(context: __compactRuntime.CircuitContext<PS>, leaf_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  settle(context: __compactRuntime.CircuitContext<PS>,
         _tournamentId_0: bigint,
         _itemId_0: bigint,
         _amount_0: bigint,
         _option_0: Uint8Array,
         _deadline_0: bigint,
         _nonce_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  setVoteSigner(context: __compactRuntime.CircuitContext<PS>,
                _voteSigner_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  setDomainTag(context: __compactRuntime.CircuitContext<PS>,
               _domainTag_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  userPublicKey(secret_0: Uint8Array): Uint8Array;
  settleLeaf(tag_0: Uint8Array,
             userPk_0: Uint8Array,
             tournamentId_0: bigint,
             itemId_0: bigint,
             amount_0: bigint,
             option_0: Uint8Array,
             deadline_0: bigint,
             nonce_0: bigint): Uint8Array;
  settleNullifier(secret_0: Uint8Array, leaf_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  userPublicKey(context: __compactRuntime.CircuitContext<PS>,
                secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  settleLeaf(context: __compactRuntime.CircuitContext<PS>,
             tag_0: Uint8Array,
             userPk_0: Uint8Array,
             tournamentId_0: bigint,
             itemId_0: bigint,
             amount_0: bigint,
             option_0: Uint8Array,
             deadline_0: bigint,
             nonce_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  settleNullifier(context: __compactRuntime.CircuitContext<PS>,
                  secret_0: Uint8Array,
                  leaf_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  grantSettle(context: __compactRuntime.CircuitContext<PS>, leaf_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  settle(context: __compactRuntime.CircuitContext<PS>,
         _tournamentId_0: bigint,
         _itemId_0: bigint,
         _amount_0: bigint,
         _option_0: Uint8Array,
         _deadline_0: bigint,
         _nonce_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  setVoteSigner(context: __compactRuntime.CircuitContext<PS>,
                _voteSigner_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  setDomainTag(context: __compactRuntime.CircuitContext<PS>,
               _domainTag_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly owner: Uint8Array;
  readonly voteSigner: Uint8Array;
  readonly domainTag: Uint8Array;
  grants: {
    isFull(): boolean;
    checkRoot(rt_0: { field: bigint }): boolean;
    root(): __compactRuntime.MerkleTreeDigest;
    firstFree(): bigint;
    pathForLeaf(index_0: bigint, leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array>;
    findPathForLeaf(leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array> | undefined;
    history(): Iterator<__compactRuntime.MerkleTreeDigest>
  };
  nullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  settlements: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Settlement;
    [Symbol.iterator](): Iterator<[Uint8Array, Settlement]>
  };
  readonly grantedCount: bigint;
  readonly settledCount: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               _voteSigner_0: Uint8Array,
               _domainTag_0: Uint8Array): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
