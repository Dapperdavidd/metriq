// packages/core/src/tasks.ts
//
// "The Briefing": one task, six priced subtasks, not a task engine. Prices in test
// OKB (wei). The rubric is deterministic and published, computed by the host, never
// by an LLM. This table is what listTask posts on chain at round open; the frontend
// reads it only for labels.

export interface SubtaskSpec {
  readonly id: string;
  readonly name: string; // FETCH, CLEAN, ...
  readonly basePrice: bigint; // wei
  readonly premiumPrice: bigint | null; // null == untiered
  readonly baseScore: number;
  readonly premiumScore: number;
  readonly required: boolean;
}

// 10n ** 18n written as a literal: the browser compiler downlevels the ** operator to
// Math.pow, which throws on BigInt operands. The literal is immune and identical in value.
const OKB = 1_000_000_000_000_000_000n;
const okb = (whole: number): bigint => (BigInt(Math.round(whole * 1000)) * OKB) / 1000n;

// # SUBTASK   BASE  PREM  REQ  RUBRIC
// 0 FETCH     0.10   --   yes  10 flat on valid payload hash
// 1 CLEAN     0.12   --   yes  10 if rows == canonical count
// 2 ENRICH    0.10  0.28  yes  base 10 (3 fields), premium 25 (9 fields)
// 3 ANALYZE   0.12  0.30  yes  base 12 (2 signals), premium 28 (5 signals)
// 4 VERIFY    0.15   --   no   8, unlocks +5 bonus on subtask 5
// 5 PUBLISH   0.20   --   yes  15 on schema-valid briefing (+5 with VERIFY)
export const SUBTASKS: readonly SubtaskSpec[] = [
  { id: "0", name: "FETCH", basePrice: okb(0.1), premiumPrice: null, baseScore: 10, premiumScore: 10, required: true },
  { id: "1", name: "CLEAN", basePrice: okb(0.12), premiumPrice: null, baseScore: 10, premiumScore: 10, required: true },
  { id: "2", name: "ENRICH", basePrice: okb(0.1), premiumPrice: okb(0.28), baseScore: 10, premiumScore: 25, required: true },
  { id: "3", name: "ANALYZE", basePrice: okb(0.12), premiumPrice: okb(0.3), baseScore: 12, premiumScore: 28, required: true },
  { id: "4", name: "VERIFY", basePrice: okb(0.15), premiumPrice: null, baseScore: 8, premiumScore: 8, required: false },
  { id: "5", name: "PUBLISH", basePrice: okb(0.2), premiumPrice: null, baseScore: 15, premiumScore: 15, required: true },
];

export const SUBTASK_BY_ID: Readonly<Record<string, SubtaskSpec>> = Object.fromEntries(
  SUBTASKS.map((s) => [s.id, s]),
);

export function subtaskName(taskId: string): string {
  return SUBTASK_BY_ID[taskId]?.name ?? `TASK ${taskId}`;
}

// Cap per agent for the scripted round: 1.00 OKB. Premium everything plus VERIFY
// costs 1.15, impossible by construction, which is exactly what caps out Greedy.
export const CAP_PER_AGENT: bigint = OKB;
