# PNYX — Authentic Data Protocol on Midnight (Frontend)

PNYX collects real human preference data through "A vs B" bracket tournaments, seals each result on
[Midnight](https://midnight.network) with a zero-knowledge proof, and sells the verified votes to
businesses through an on-chain licensed data market. This repository is the Next.js frontend.

Built for the **Midnight Korea Hackathon 2026**. Deployed on Midnight **preprod**.

| Repository | Role |
| --- | --- |
| **PNYX-FE-Midnight** (this repo) | Next.js app: wallet login, tournament play, in-browser ZK proving, data market, buyer verification |
| [PNYX-BE-Midnight](https://github.com/DeSPELL-Admin/PNYX-BE-Midnight) | NestJS API: eligibility grants (operator wallet), escrow, order fulfilment (`registerBuyer` → `sellRows`) |
| [PNYX-Contract-Midnight](https://github.com/DeSPELL-Admin/PNYX-Contract-Midnight) | Compact contract `TournamentFinalizer`, simulator tests, deploy scripts |

## What it does

1. **Play** — connect a Midnight wallet (Lace or 1AM), sign in with `signData`, pick a 16/32/64-round
   tournament and choose A or B until one champion remains.
2. **Prove & submit** — the backend validates the bracket and registers an *eligibility leaf* on-chain.
   The browser then proves `finalizeTournament{16|32|64}` (Merkle membership of that leaf, a per-user
   nullifier, and a sealed commitment of the whole bracket) and the wallet signs and submits the
   transaction. Nothing about the picks is public on-chain; only the commitment, the nullifier and the
   per-tournament sample count are.
3. **Sell** — `/market` lists tournaments with escrowed votes. A buyer orders, pays tNIGHT from the
   wallet, and the backend fulfils the order on-chain: `registerBuyer` → pin the dataset hash →
   `sellRows` (the contract proves every sold row matches an on-chain commitment) → `License`.
4. **Verify** — the order page downloads the dataset and checks, without trusting the server,
   `sha256(bytes) == License.datasetHash`, `rowCount == sampleAtSale`, the buyer binding and every
   row's `voteCommitment` against the ledger read through the indexer.

## Midnight usage

- **Contract**: `TournamentFinalizer` (Compact), preprod address
  `1fe82f185fe7187ef335365c1ccf9fa7bc47b7a03fab84372d70c73262d00249`.
- **Public ledger**: `eligibility` Merkle tree, `nullifiers`, `voteCommits`, `sampleCount`, `buyers`, `licenses`.
- **Private (witness)**: `userSecret`, `voteSalt`, Merkle path, champion, bracket, segment — kept in the
  browser (`localStorage`) and sent only to the proof server the user selects.
- **Wallet**: DApp Connector v4 (`window.midnight.*`), Lace and 1AM.
- **Proving**: midnight-js 4.1.1 in the browser; prover keys are served from `public/zk/`
  (16-round proof ≈ 30 s on a local proof server).
- **Indexer**: contract state is read via the official preprod indexer API v4 through a same-origin
  proxy (`/midnight-indexer/graphql`, see `next.config.ts`).

## Run locally

Prerequisites: Node 22, pnpm (`corepack enable`), Docker (proof server), the backend running on
`http://localhost:3001` (see PNYX-BE-Midnight), and a Midnight wallet extension on **preprod** holding
tNIGHT and DUST (faucet: https://faucet.preprod.midnight.network).

```bash
pnpm install
cp .env.example .env.local
# .env.local — minimum:
#   NEXT_PUBLIC_API_URL=http://localhost:3001
#   NEXT_PUBLIC_MIDNIGHT_NETWORK=preprod
#   NEXT_PUBLIC_CONTRACT_TOURNAMENT_FINALIZER_MIDNIGHT=1fe82f185fe7187ef335365c1ccf9fa7bc47b7a03fab84372d70c73262d00249
#   NEXT_PUBLIC_MIDNIGHT_PROOF_SERVER_URL=http://127.0.0.1:6300

pnpm proof-server   # docker: midnightntwrk/proof-server:8.1.0 on :6300 (skip if your wallet has one configured)
pnpm dev            # http://localhost:3000 — webpack dev server (not turbopack: WASM + top-level await)
```

Other commands:

```bash
pnpm build          # production build
pnpm typecheck      # tsc --noEmit
pnpm sync:contract  # local dev only — copies compiled contract + zk assets from a sibling PNYX-Contract checkout
```

The compiled contract (`src/midnight/contract/**`) and the zk assets (`public/zk/**`) are **committed**, so
a fresh clone builds without the contract repo. Re-run `pnpm sync:contract` and commit the result only
when the contract changes.

## Demo flow

Connect wallet → Sign in → pick a tournament → 16 rounds → **SUBMIT** → "Recording on-chain" (grant) →
"Proving" (~30 s) → approve twice in the wallet (Balance & Sign, Submit) → Result → `/market` → **BUY** →
approve the tNIGHT transfer → order page shows fulfilment (Payment recorded → Registering buyer →
Building dataset → Generating ZK proof → Confirming on-chain → Complete) → **Download & Verify** →
**View data**.

Wallet notes: the wallet must be on the same network as `NEXT_PUBLIC_MIDNIGHT_NETWORK`. One wallet can
submit each tournament once (`AlreadyFinalized` = the nullifier is spent).

## Project layout

```
src/app/                 routes: / (home), /tournament, /hall, /market, /market/orders/[id](/data), /mypage, /login, /share/[id]
src/lib/midnight/        config, connector (wallet), providers (midnight-js), proofServer, contract, session,
                         privateState, userKeys, payment (market transfer), license (buyer-side verification)
src/hooks/contract/      useFinalizeTournament — grant ∥ join → prove → submit → confirm ∥ escrow
src/hooks/market/        useBuyDataset, useOrder, pendingPaymentTx
src/midnight/contract/   generated contract module + witnesses (committed)
public/zk/               prover/verifier keys + zkir for the user circuits (committed)
```

## License

Hackathon submission by DeSPELL. All rights reserved unless stated otherwise.
