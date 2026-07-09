#!/usr/bin/env bash
# scripts/e2e.sh
#
# The full local end-to-end proof, no testnet and no OKX:
#   1. start a local anvil node,
#   2. deploy Tallo + TaskRouter to it,
#   3. run the orchestrator (four seeded agents, real pay()s) with the indexer watching,
#   4. fold the indexed events with the shared reducer and assert the standings.
#
# The operator key here is anvil's well-known dev key. It is a throwaway local key,
# never a real one.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ANVIL_LOG="/tmp/metriq-anvil.log"
DEPLOY_LOG="/tmp/metriq-deploy.log"

cleanup() {
  [ -n "${ANVIL_PID:-}" ] && kill "$ANVIL_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "==> starting anvil"
anvil > "$ANVIL_LOG" 2>&1 &
ANVIL_PID=$!

# wait for anvil to be ready
for i in $(seq 1 20); do
  if cast block-number --rpc-url http://127.0.0.1:8545 >/dev/null 2>&1; then break; fi
  sleep 0.3
done

# anvil's first dev private key (throwaway, local only)
KEY=$(grep -m1 -oE '0x[a-fA-F0-9]{64}' "$ANVIL_LOG")
export OPERATOR_KEY="$KEY"
export RPC_URL="http://127.0.0.1:8545"
export CHAIN_ID="31337"
export ROUND_ID="0x3fa9"

echo "==> deploying contracts"
( cd contracts && forge script script/Deploy.s.sol \
    --rpc-url "$RPC_URL" --broadcast --private-key "$KEY" > "$DEPLOY_LOG" 2>&1 )

TALLO=$(grep -E "Tallo\s+:" "$DEPLOY_LOG" | grep -oE '0x[a-fA-F0-9]{40}' | head -1)
ROUTER=$(grep -E "TaskRouter\s+:" "$DEPLOY_LOG" | grep -oE '0x[a-fA-F0-9]{40}' | head -1)
export TALLO_ADDRESS="$TALLO"
export TASK_ROUTER_ADDRESS="$ROUTER"

echo "==> Tallo=$TALLO  TaskRouter=$ROUTER"
echo "==> running the orchestrator + indexer end to end"
( cd apps/orchestrator && npx tsx scripts/e2e-anvil.ts )
