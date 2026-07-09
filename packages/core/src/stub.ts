// packages/core/src/stub.ts
//
// A Stub is not a new contract. It is a rendering rule over events that already
// exist: one completed subtask emits a "stub" event (with its paired "charged"),
// and foldStubs folds that into a receipt whose serial is the tx hash. This is
// what upgrades "trust the leaderboard" to "verify the leaderboard": every number
// resolves to a tx a judge can open on the X Layer explorer. (Ring 2.)

import type { RunEvent, Tier } from "./events.js";
import { formatOkb } from "./format.js";
import { subtaskName } from "./tasks.js";

export interface Stub {
  serial: string; // the Stub tx hash, or a display serial under the mock
  roundId: string;
  agent: string;
  taskId: string;
  label: string; // "ENRICH · PREMIUM" (middot, never an em dash)
  tier: Tier;
  costOkb: string;
  quality: number;
  remainingOkb: string;
  explorerUrl: string;
  at: number;
}

export interface FoldStubsOptions {
  roundId?: string;
  explorerBase?: string;
}

export function stubLabel(taskId: string, tier: Tier): string {
  return `${subtaskName(taskId)} · ${tier}`;
}

// Pure reducer. Walks the event stream, tracking each agent's most recent remaining
// balance from "charged" events (which land in the same tx as the "stub"), and mints
// one receipt per "stub" event.
export function foldStubs(events: readonly RunEvent[], opts: FoldStubsOptions = {}): Stub[] {
  const roundId = opts.roundId ?? "0x0";
  const explorerBase = opts.explorerBase ?? "";
  const remainingByAgent = new Map<string, string>();
  const stubs: Stub[] = [];

  for (const e of events) {
    if (e.kind === "charged") {
      remainingByAgent.set(e.agentId, e.remaining);
      continue;
    }
    if (e.kind === "stub") {
      const remaining = remainingByAgent.get(e.agentId) ?? "0";
      const serial = e.txHash ?? "0x0";
      stubs.push({
        serial,
        roundId,
        agent: e.agentId,
        taskId: e.taskId,
        label: stubLabel(e.taskId, e.tier),
        tier: e.tier,
        costOkb: formatOkb(e.price),
        quality: e.score,
        remainingOkb: formatOkb(remaining),
        explorerUrl: explorerBase ? `${explorerBase}/tx/${serial}` : "",
        at: e.ts,
      });
    }
  }

  return stubs;
}
