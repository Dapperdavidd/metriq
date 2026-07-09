// apps/orchestrator/scripts/e2e-anvil.ts
//
// The end-to-end proof, on a real EVM, with no testnet and no OKX. It:
//   1. connects to a local anvil node with the contracts already deployed,
//   2. starts the indexer watching the chain,
//   3. runs the orchestrator, which drives the four seeded agents through real pay()s,
//   4. folds the indexed RunEvents with the SAME reducer the frontend uses,
//   5. asserts the standings match the scripted drama.
//
// If this passes, the mock-to-SSE swap is proven: real chain events fold to the same
// standings the mock produces. Run via scripts/e2e.sh (which starts anvil + deploys).

import { RunEventBus, makePublicClient, watchRun } from "@metriq/chain";
import { foldEvents, rankLanes, type RunEvent } from "@metriq/core";
import { loadConfig } from "../src/config";
import { runVerso } from "../src/run";
import { sleep } from "../src/util";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const publicClient = makePublicClient(cfg);
  const bus = new RunEventBus();

  const collected: RunEvent[] = [];
  bus.subscribe(cfg.roundId, (e) => collected.push(e));

  // Start indexing before the orchestrator writes anything.
  const unwatch = watchRun(publicClient, { tallo: cfg.tallo, taskRouter: cfg.taskRouter }, cfg.roundId, bus, 150);

  console.log("indexer watching; starting the orchestrator...\n");
  await runVerso(cfg, (msg) => console.log(`  [orch] ${msg}`));

  // Let the poller drain the final events (finish, capped).
  await sleep(1500);
  unwatch();

  const state = foldEvents(collected);
  const ranked = rankLanes(state.lanes);
  const order = ranked.map((l) => l.agentId).join(" > ");

  console.log("\nIndexed RunEvents:", collected.length);
  console.log("Standings folded from CHAIN events (same reducer as the frontend):\n");
  for (const l of ranked) {
    const flag = l.status === "eliminated" ? "OUT" : l.reachedTarget ? "TGT" : "   ";
    console.log(
      `  ${l.rank}. ${l.name.padEnd(13)} ${flag}  score ${String(l.score).padStart(3)}  ` +
        `spent ${(Number(l.spent) / 1e18).toFixed(2)}  val/OKB ${l.valuePerOkb.toFixed(2)}` +
        (l.reason ? `  (${l.reason})` : ""),
    );
  }
  console.log(`\nCopilot: "${state.copilotLine}"`);

  let failed = false;
  const check = (cond: boolean, msg: string): void => {
    if (!cond) {
      console.error("ASSERT FAILED:", msg);
      failed = true;
    }
  };

  const greedy = state.lanes.find((l) => l.agentId === "greedy");
  check(collected.length > 0, "indexer must produce events");
  check(greedy?.status === "eliminated", "greedy must be eliminated on chain");
  check(order === "adaptive > balanced > conservative > greedy", `order was: ${order}`);
  check(state.phase === "settled", "round must settle");

  if (failed) {
    console.error("\nE2E FAILED\n");
    process.exitCode = 1;
  } else {
    console.log("\nE2E PASSED: real chain events fold to the scripted standings. Mock and SSE are interchangeable.\n");
  }
}

main().catch((err) => {
  console.error("e2e failed:", err);
  process.exitCode = 1;
});
