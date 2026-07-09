// packages/strategies/src/types.ts
//
// The competitors are one base agent running four tuned spend policies. A strategy
// is a pure function of run context, no LLM in the decision loop, which is what
// makes the demo reproducible take after take. These types are the decision loop's
// contract; the four seeds land in policies.ts (Phase 3).

export interface Task {
  id: string;
  basePrice: bigint;
  premiumPrice: bigint | null; // null == untiered
  baseScore: number;
  premiumScore: number;
  required: boolean;
}

export interface RoundState {
  roundId: string;
  agentId: string;
  cap: bigint;
  spent: bigint;
  remaining: Task[];
  completed: ReadonlySet<string>;
}

export type SpendDecision = { taskId: string; tier: "BASE" | "PREMIUM" } | null;

export interface Knobs {
  reserve: number;
  greed: number;
  horizon: number;
}

export interface Strategy {
  readonly name: string;
  readonly displayColor: string;
  readonly knobs: Knobs;
  decide(state: RoundState): SpendDecision;
}
