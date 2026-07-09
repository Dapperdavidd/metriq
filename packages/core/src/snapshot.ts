// packages/core/src/snapshot.ts
//
// The Copilot snapshot: a JSON-safe view of RunState (no bigints) that the host sends
// to the model. It carries the deterministic fallbackLine the client already computed,
// so the host can return that verbatim when the live call is unavailable. The narrator
// and the tower read the same reducer state, so their numbers can never disagree.

import { formatOkb } from "./format";
import type { LaneStatus, RunPhase, RunState } from "./reducer";

export interface SnapshotLane {
  name: string;
  rank: number;
  valuePerOkb: number;
  score: number;
  status: LaneStatus;
  reachedTarget: boolean;
  remainingOkb: string;
}

export interface RunSnapshot {
  phase: RunPhase;
  lanes: SnapshotLane[];
  fallbackLine: string;
}

export function toSnapshot(s: RunState): RunSnapshot {
  return {
    phase: s.phase,
    lanes: s.lanes.map((l) => ({
      name: l.name,
      rank: l.rank,
      valuePerOkb: Number(l.valuePerOkb.toFixed(2)),
      score: l.score,
      status: l.status,
      reachedTarget: l.reachedTarget,
      remainingOkb: formatOkb(l.remaining),
    })),
    fallbackLine: s.copilotLine,
  };
}
