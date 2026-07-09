// apps/web/src/lib/accent.ts
//
// The F1 timing semantics, in one place: purple = best, green = improving, red = out,
// mapped onto value per dollar. A vocabulary spectators read in half a second.

import type { Lane } from "@metriq/core";

export function laneAccent(lane: Lane): string {
  if (lane.status === "eliminated") return "var(--lane-red)"; // out
  if (lane.rank === 1) return "var(--lane-purple)"; // best
  if (lane.delta > 0) return "var(--lane-green)"; // improving
  return "var(--ink)";
}

export function clockLabel(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
