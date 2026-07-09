// packages/core/src/events.ts
//
// FROZEN. This union is the single wire contract between the indexer (real) and
// the MockRunSource (canned), and between the backend and the frontend. Both the
// tower and the Copilot fold RunEvent[] into RunState with the same pure reducer,
// so the number on screen and the number narrated can never disagree.
//
// One additive field beyond the System Design doc: the "stub" event carries an
// optional txHash. The Ring 2 receipt's serial IS the tx hash, and no other event
// carries it, so it lives here on the event that mints the receipt. Ring 1 ignores
// it; the mock supplies a display serial. Everything else matches the doc verbatim.

export type Tier = "BASE" | "PREMIUM";

export type RunEvent =
  | { kind: "opened"; ts: number; agentId: string; cap: string }
  | {
      kind: "stub";
      ts: number;
      agentId: string;
      taskId: string;
      tier: Tier;
      price: string;
      score: number;
      cumulativeScore: number;
      txHash?: string;
    }
  | { kind: "charged"; ts: number; agentId: string; amount: string; remaining: string }
  | {
      kind: "declined";
      ts: number;
      agentId: string;
      taskId: string;
      attempted: string;
      remaining: string;
    }
  | { kind: "capped"; ts: number; agentId: string; totalSpent: string }
  | { kind: "finished"; ts: number; agentId: string; totalScore: number }
  | { kind: "revealed"; ts: number; agentId: string; ok: boolean }
  | { kind: "feed-lost"; ts: number };

export type RunEventKind = RunEvent["kind"];
