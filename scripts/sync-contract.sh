#!/usr/bin/env bash
# Copy the compiled Compact contract from ../PNYX-Contract into this app:
#   src/midnight/contract/   ← generated TS/JS (Contract, ledger(), pureCircuits) + witnesses
#   public/zk/<Name>/        ← keys/ + zkir/ served to FetchZkConfigProvider
# Run after `npm run compact` in ../PNYX-Contract (proving keys must exist).
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$HERE/../PNYX-Contract/contracts"
for NAME in TournamentFinalizer VotePointManager; do
  M="$SRC/managed/$NAME"
  [ -f "$M/keys/finalizeTournament16.prover" ] || [ -f "$M/keys/settle.prover" ] || { echo "no proving keys in $M — run 'npm run compact' in PNYX-Contract"; exit 1; }
  mkdir -p "$HERE/src/midnight/contract/$NAME" "$HERE/public/zk/$NAME"
  cp "$M/contract/index.js" "$M/contract/index.d.ts" "$HERE/src/midnight/contract/$NAME/"
  # prover/zkir: only the circuits a *user* proves in the browser (operator circuits stay server-side).
  # verifier: ALL circuits — midnight-js fetches every verifier key when joining the contract.
  rm -rf "$HERE/public/zk/$NAME/keys" "$HERE/public/zk/$NAME/zkir"; mkdir -p "$HERE/public/zk/$NAME/keys" "$HERE/public/zk/$NAME/zkir"
  cp "$M"/keys/*.verifier "$HERE/public/zk/$NAME/keys/"
  for C in finalizeTournament16 finalizeTournament32 finalizeTournament64 settle; do
    if [ -f "$M/keys/$C.prover" ]; then cp "$M/keys/$C.prover" "$HERE/public/zk/$NAME/keys/"; cp "$M/zkir/$C.bzkir" "$HERE/public/zk/$NAME/zkir/"; fi
  done
done
cp "$SRC/witnesses/TournamentFinalizer.witnesses.ts" "$HERE/src/midnight/contract/TournamentFinalizer.witnesses.ts"
# the witnesses file imports the managed contract relatively; rewrite for this layout
sed -i '' 's#"../managed/TournamentFinalizer/contract/index.js"#"./TournamentFinalizer/index.js"#' "$HERE/src/midnight/contract/TournamentFinalizer.witnesses.ts"
echo "synced: $(du -sh "$HERE/public/zk" | cut -f1) of zk assets"
