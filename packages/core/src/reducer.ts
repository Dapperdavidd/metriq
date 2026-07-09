// packages/core/src/reducer.ts
//
// FROZEN. The one pure fold. The backend builds Copilot snapshots with it and the
// frontend renders the tower with it, so the tower's number and the Copilot's
// number are the same number by construction. No game logic lives anywhere else.

import { agentMeta } from "./agents";
import type { RunEvent } from "./events";
import { formatOkb } from "./format";
import { QUALITY_TARGET, valuePerOkb } from "./metric";
import type { Stub } from "./stub";
import { stubLabel } from "./stub";
import { subtaskName } from "./tasks";

export type LaneStatus = "racing" | "finished" | "eliminated";

export interface Lane {
  agentId: string;
  name: string;
  displayColor: string;
  cap: bigint;
  spent: bigint;
  remaining: bigint;
  score: number;
  valuePerOkb: number;
  reachedTarget: boolean;
  rank: number;
  delta: number; // change in value per OKB from the event just folded; drives the green accent
  status: LaneStatus;
  lastTask?: string;
  reason?: string; // human reason on the eliminated lane, e.g. "ELIMINATED at PUBLISH"
  revealed?: boolean; // Ring 3 green tick on the winner lane
}

export type RunPhase = "idle" | "live" | "settled";

export interface RunState {
  lanes: Lane[];
  stubs: Stub[];
  copilotLine: string;
  phase: RunPhase;
  clock: number;
  feedLost: boolean;
}

export const initialRun: RunState = {
  lanes: [],
  stubs: [],
  copilotLine: "",
  phase: "idle",
  clock: 0,
  feedLost: false,
};

const cap = (n: string): string => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();

// Tower ordering: eliminated lanes pinned last, then lanes that reached the quality
// target (by value per OKB), then the rest. This is the two-key rank that stops a
// barely-spending agent from winning on raw efficiency alone.
export function rankLanes(lanes: readonly Lane[]): Lane[] {
  return [...lanes].sort(
    (a, b) =>
      Number(a.status === "eliminated") - Number(b.status === "eliminated") ||
      Number(b.reachedTarget) - Number(a.reachedTarget) ||
      b.valuePerOkb - a.valuePerOkb,
  );
}

// Deterministic Copilot line, folded from the same state. The live Claude call sits
// in front of this; when it fails, times out, or parses empty, this guarantees the
// practicality surface never goes blank in front of a judge.
export function fallbackLine(s: RunState): string {
  const leader = s.lanes.find((l) => l.rank === 1 && l.status !== "eliminated");
  if (!leader) return "";
  const out = s.lanes.find((l) => l.status === "eliminated");
  const spare = formatOkb(leader.remaining);
  const why = out ? `${cap(out.name)} capped chasing raw score` : `holding ${spare} OKB in reserve`;
  return `${cap(leader.name)} leads on value per OKB, ${why}.`;
}

function recompute(lane: Lane): void {
  if (lane.status === "eliminated") return; // metric frozen at cap-out
  lane.valuePerOkb = valuePerOkb(lane.score, lane.spent);
  lane.reachedTarget = lane.score >= QUALITY_TARGET;
}

function cloneLane(l: Lane): Lane {
  return { ...l };
}

export function reduceRun(state: RunState, e: RunEvent): RunState {
  const lanes = state.lanes.map(cloneLane);
  const stubs = state.stubs;
  let nextStubs = stubs;
  let feedLost = state.feedLost;

  // Delta is a per-event pulse: only the lane touched by this event can flash green.
  for (const l of lanes) l.delta = 0;

  const find = (agentId: string): Lane | undefined => lanes.find((l) => l.agentId === agentId);

  switch (e.kind) {
    case "opened": {
      if (!find(e.agentId)) {
        const meta = agentMeta(e.agentId);
        const capWei = BigInt(e.cap);
        lanes.push({
          agentId: e.agentId,
          name: meta.name,
          displayColor: meta.displayColor,
          cap: capWei,
          spent: 0n,
          remaining: capWei,
          score: 0,
          valuePerOkb: 0,
          reachedTarget: false,
          rank: 0,
          delta: 0,
          status: "racing",
        });
      }
      break;
    }
    case "charged": {
      const lane = find(e.agentId);
      if (lane && lane.status !== "eliminated") {
        const before = lane.valuePerOkb;
        lane.spent += BigInt(e.amount);
        lane.remaining = BigInt(e.remaining);
        recompute(lane);
        lane.delta = lane.valuePerOkb - before;
      }
      break;
    }
    case "stub": {
      const lane = find(e.agentId);
      if (lane && lane.status !== "eliminated") {
        const before = lane.valuePerOkb;
        lane.score = e.cumulativeScore;
        lane.lastTask = e.taskId;
        recompute(lane);
        lane.delta = lane.valuePerOkb - before;
        const receipt: Stub = {
          serial: e.txHash ?? "0x0",
          roundId: "",
          agent: e.agentId,
          taskId: e.taskId,
          label: stubLabel(e.taskId, e.tier),
          tier: e.tier,
          costOkb: formatOkb(e.price),
          quality: e.score,
          remainingOkb: formatOkb(lane.remaining),
          explorerUrl: "",
          at: e.ts,
        };
        nextStubs = [...stubs, receipt];
      }
      break;
    }
    case "declined": {
      // The declined event carries the exact task the cap breached on. It is the
      // authority for the cap-out reason. On chain the indexer's CappedOut and
      // PaymentDeclined watchers can arrive in either order, so if the lane is already
      // eliminated, reconcile the reason here too.
      const lane = find(e.agentId);
      if (lane) {
        lane.lastTask = e.taskId;
        if (lane.status === "eliminated") lane.reason = `ELIMINATED at ${subtaskName(e.taskId)}`;
      }
      break;
    }
    case "capped": {
      const lane = find(e.agentId);
      if (lane) {
        lane.spent = BigInt(e.totalSpent);
        lane.remaining = lane.cap > lane.spent ? lane.cap - lane.spent : 0n;
        lane.status = "eliminated";
        lane.reason = lane.lastTask ? `ELIMINATED at ${subtaskName(lane.lastTask)}` : "ELIMINATED";
        // value per OKB is left frozen at its last racing value
      }
      break;
    }
    case "finished": {
      const lane = find(e.agentId);
      if (lane && lane.status !== "eliminated") {
        lane.score = e.totalScore;
        lane.status = "finished";
        recompute(lane);
      }
      break;
    }
    case "revealed": {
      const lane = find(e.agentId);
      if (lane) lane.revealed = e.ok;
      break;
    }
    case "feed-lost": {
      feedLost = true;
      break;
    }
  }

  const ranked = rankLanes(lanes);
  ranked.forEach((l, i) => {
    l.rank = i + 1;
  });

  const everyDone = ranked.length > 0 && ranked.every((l) => l.status !== "racing");
  const phase: RunPhase = ranked.length === 0 ? "idle" : everyDone ? "settled" : "live";

  const next: RunState = {
    lanes: ranked,
    stubs: nextStubs,
    copilotLine: state.copilotLine,
    phase,
    clock: e.ts || state.clock,
    feedLost,
  };
  next.copilotLine = fallbackLine(next);
  return next;
}

export function foldEvents(events: readonly RunEvent[]): RunState {
  return events.reduce(reduceRun, initialRun);
}
