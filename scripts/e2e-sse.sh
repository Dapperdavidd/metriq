#!/usr/bin/env bash
# scripts/e2e-sse.sh
#
# The full three-process proof over HTTP: anvil (chain) + host (indexer + SSE route) +
# orchestrator (drives the field). Connects an SSE client BEFORE the run, so it proves
# the LIVE stream, then folds the captured events with the shared reducer.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ANVIL_LOG="/tmp/metriq-anvil.log"
DEPLOY_LOG="/tmp/metriq-deploy.log"
HOST_LOG="/tmp/metriq-host.log"
SSE_LOG="/tmp/metriq-sse.log"

cleanup() {
  [ -n "${CURL_PID:-}" ] && kill "$CURL_PID" 2>/dev/null || true
  [ -n "${HOST_PID:-}" ] && kill "$HOST_PID" 2>/dev/null || true
  [ -n "${ANVIL_PID:-}" ] && kill "$ANVIL_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "==> starting anvil"
anvil > "$ANVIL_LOG" 2>&1 &
ANVIL_PID=$!
for i in $(seq 1 20); do
  cast block-number --rpc-url http://127.0.0.1:8545 >/dev/null 2>&1 && break
  sleep 0.3
done

KEY=$(grep -m1 -oE '0x[a-fA-F0-9]{64}' "$ANVIL_LOG")
export OPERATOR_KEY="$KEY" RPC_URL="http://127.0.0.1:8545" CHAIN_ID="31337" ROUND_ID="0x3fa9"

echo "==> deploying contracts"
( cd contracts && forge script script/Deploy.s.sol --rpc-url "$RPC_URL" --broadcast --private-key "$KEY" > "$DEPLOY_LOG" 2>&1 )
export TALLO_ADDRESS=$(grep -E "Tallo\s+:" "$DEPLOY_LOG" | grep -oE '0x[a-fA-F0-9]{40}' | head -1)
export TASK_ROUTER_ADDRESS=$(grep -E "TaskRouter\s+:" "$DEPLOY_LOG" | grep -oE '0x[a-fA-F0-9]{40}' | head -1)
echo "==> Tallo=$TALLO_ADDRESS  TaskRouter=$TASK_ROUTER_ADDRESS"

echo "==> starting host (indexer + SSE) on :3001"
( cd apps/host && npx next dev -p 3001 > "$HOST_LOG" 2>&1 ) &
HOST_PID=$!
for i in $(seq 1 60); do
  curl -s -o /dev/null "http://127.0.0.1:3001/" && break
  sleep 0.5
done

echo "==> opening the SSE stream before the run (compiles the route, starts the indexer)"
curl -sN "http://127.0.0.1:3001/api/round/${ROUND_ID}/stream" > "$SSE_LOG" &
CURL_PID=$!
sleep 6 # let the route compile and the indexer start watching

echo "==> running the orchestrator (drives anvil, posts host echoes)"
( cd apps/orchestrator && HOST_BASE="http://127.0.0.1:3001" npx tsx src/main.ts 2>&1 | sed 's/^/  [orch] /' )

echo "==> draining the stream"
sleep 3
kill "$CURL_PID" 2>/dev/null || true
CURL_PID=""

( cd apps/orchestrator && npx tsx scripts/check-sse.ts "$SSE_LOG" )
