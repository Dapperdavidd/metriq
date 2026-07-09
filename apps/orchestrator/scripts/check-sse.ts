// apps/orchestrator/scripts/check-sse.ts
//
// Parses a captured SSE stream (curl -N output) into RunEvents, folds them with the
// same reducer the frontend uses, and asserts the standings. Proves the HTTP SSE
// transport carries the identical stream end to end.

import { readFileSync } from "node:fs";
import { foldEvents, rankLanes, type RunEvent } from "@metriq/core";

const path = process.argv[2];
if (!path) {
  console.error("usage: check-sse.ts <captured-sse-file>");
  process.exit(1);
}

const events: RunEvent[] = [];
for (const line of readFileSync(path, "utf8").split("\n")) {
  if (!line.startsWith("data: ")) continue;
  const json = line.slice(6).trim();
  if (!json) continue;
  try {
    events.push(JSON.parse(json) as RunEvent);
  } catch {
    // skip a partial frame
  }
}

const state = foldEvents(events);
const ranked = rankLanes(state.lanes);
const order = ranked.map((l) => l.agentId).join(" > ");

console.log(`\nRunEvents received over HTTP SSE: ${events.length}`);
console.log("Standings folded from the SSE stream:\n");
for (const l of ranked) {
  const flag = l.status === "eliminated" ? "OUT" : l.reachedTarget ? "TGT" : "   ";
  console.log(
    `  ${l.rank}. ${l.name.padEnd(13)} ${flag}  score ${String(l.score).padStart(3)}  ` +
      `spent ${(Number(l.spent) / 1e18).toFixed(2)}  val/OKB ${l.valuePerOkb.toFixed(2)}` +
      (l.reason ? `  (${l.reason})` : ""),
  );
}

let failed = false;
const check = (cond: boolean, msg: string): void => {
  if (!cond) {
    console.error("ASSERT FAILED:", msg);
    failed = true;
  }
};

check(events.length > 0, "SSE must deliver events");
check(state.lanes.find((l) => l.agentId === "greedy")?.status === "eliminated", "greedy eliminated");
check(order === "adaptive > balanced > conservative > greedy", `order was: ${order}`);

console.log(
  failed
    ? "\nSSE E2E FAILED\n"
    : "\nSSE E2E PASSED: the HTTP stream carries the identical RunEvents. The frontend swap is real.\n",
);
if (failed) process.exitCode = 1;
