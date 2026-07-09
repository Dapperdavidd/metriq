// packages/strategies/scripts/simulate.ts
//
// Runs each seeded strategy through "The Briefing" against the exact decline mechanics
// the chain enforces (a purchase over the remaining cap eliminates the agent). Pure,
// no chain, no LLM. Verifies the field produces a real race: greedy caps out, the
// others finish, adaptive leads on score. Run: pnpm --filter @metriq/strategies simulate

import { FIELD } from "../src/policies";
import type { RoundState, Task } from "../src/types";

const OKB = 10n ** 18n;
const okb = (n: number): bigint => (BigInt(Math.round(n * 1000)) * OKB) / 1000n;

// Tuning-day levers (July 15): premium prices on ENRICH (2) and ANALYZE (3) nudge by
// +/-0.02 to keep Adaptive vs Conservative close while Greedy's cap-out stays at PUBLISH.
// Override without editing source, e.g. ENRICH_PREMIUM=0.26 ANALYZE_PREMIUM=0.32 simulate.
const ENRICH_PREM = Number(process.env.ENRICH_PREMIUM ?? "0.28");
const ANALYZE_PREM = Number(process.env.ANALYZE_PREMIUM ?? "0.30");
const TARGET = Number(process.env.QUALITY_TARGET ?? "80");

// The Briefing, mirroring packages/core/src/tasks.ts (inlined to keep strategies
// dependency-free).
const BRIEFING: Task[] = [
  { id: "0", basePrice: okb(0.1), premiumPrice: null, baseScore: 10, premiumScore: 10, required: true },
  { id: "1", basePrice: okb(0.12), premiumPrice: null, baseScore: 10, premiumScore: 10, required: true },
  { id: "2", basePrice: okb(0.1), premiumPrice: okb(ENRICH_PREM), baseScore: 10, premiumScore: 25, required: true },
  { id: "3", basePrice: okb(0.12), premiumPrice: okb(ANALYZE_PREM), baseScore: 12, premiumScore: 28, required: true },
  { id: "4", basePrice: okb(0.15), premiumPrice: null, baseScore: 8, premiumScore: 8, required: false },
  { id: "5", basePrice: okb(0.2), premiumPrice: null, baseScore: 15, premiumScore: 15, required: true },
];
const NAME: Record<string, string> = { "0": "FETCH", "1": "CLEAN", "2": "ENRICH", "3": "ANALYZE", "4": "VERIFY", "5": "PUBLISH" };
const CAP = OKB;

interface Result {
  name: string;
  spent: bigint;
  score: number;
  vpd: number;
  outcome: string;
  path: string[];
}

function priceOf(t: Task, premium: boolean): bigint {
  return premium && t.premiumPrice !== null ? t.premiumPrice : t.basePrice;
}
function baseScoreOf(t: Task, premium: boolean): number {
  return premium && t.premiumPrice !== null ? t.premiumScore : t.baseScore;
}

function run(strategyName: string): Result {
  const strategy = FIELD.find((s) => s.name === strategyName)!;
  const state: RoundState = {
    roundId: "0xsim",
    agentId: strategyName,
    cap: CAP,
    spent: 0n,
    remaining: [...BRIEFING],
    completed: new Set<string>(),
  };
  const completed = state.completed as Set<string>;
  const path: string[] = [];
  let score = 0;
  let outcome = "finished";

  for (let guard = 0; guard < 20; guard++) {
    const decision = strategy.decide(state);
    if (decision === null) break;

    const task = BRIEFING.find((t) => t.id === decision.taskId)!;
    const premium = decision.tier === "PREMIUM";
    const price = priceOf(task, premium);

    if (state.spent + price > state.cap) {
      outcome = `ELIMINATED at ${NAME[task.id]}`;
      break;
    }

    state.spent += price;
    completed.add(task.id);
    state.remaining = state.remaining.filter((t) => t.id !== task.id);
    // PUBLISH earns +5 if VERIFY was completed first.
    const bonus = task.id === "5" && completed.has("4") ? 5 : 0;
    score += baseScoreOf(task, premium) + bonus;
    path.push(`${NAME[task.id]}${premium ? "*" : ""}`);
  }

  const vpd = state.spent > 0n ? score / (Number(state.spent) / 1e18) : 0;
  return { name: strategyName, spent: state.spent, score, vpd, outcome, path };
}

const results = FIELD.map((s) => run(s.name));

console.log("\nThe Briefing, driven by the seeded strategies (real decline mechanics):\n");
for (const r of results.sort((a, b) => b.score - a.score)) {
  console.log(
    `  ${r.name.padEnd(13)} spent ${(Number(r.spent) / 1e18).toFixed(2)}  score ${String(r.score).padStart(3)}  ` +
      `val/OKB ${r.vpd.toFixed(1).padStart(5)}  ${r.outcome}`,
  );
  console.log(`  ${" ".repeat(13)} route: ${r.path.join(" -> ")}\n`);
}

const by = Object.fromEntries(results.map((r) => [r.name, r]));
let failed = false;
const check = (cond: boolean, msg: string): void => {
  if (!cond) {
    console.error("ASSERT FAILED:", msg);
    failed = true;
  }
};

// Tuning-day invariants, printed so the levers can be dialed by eye.
const gap = Math.abs(by.adaptive!.vpd - by.conservative!.vpd);
console.log(`Tuning invariants (ENRICH prem ${ENRICH_PREM}, ANALYZE prem ${ANALYZE_PREM}, target ${TARGET}):`);
console.log(`  Greedy caps at:              ${by.greedy!.outcome.replace("ELIMINATED at ", "")}`);
console.log(`  Adaptive reaches target:     ${by.adaptive!.score >= TARGET}`);
console.log(`  Conservative reaches target: ${by.conservative!.score >= TARGET} (should be false)`);
console.log(`  Adaptive vs Conservative val/OKB gap: ${gap.toFixed(2)} (target: within ~2)\n`);

check(by.greedy!.outcome === "ELIMINATED at PUBLISH", "greedy must cap out at PUBLISH");
check(by.adaptive!.outcome === "finished", "adaptive must finish");
check(by.balanced!.outcome === "finished", "balanced must finish");
check(by.conservative!.outcome === "finished", "conservative must finish");
check(by.adaptive!.score >= by.balanced!.score, "adaptive must score >= balanced");
check(by.adaptive!.score > by.conservative!.score, "adaptive must out-score conservative");
check(by.conservative!.score < TARGET, "conservative must miss the quality target");

console.log(failed ? "\nSIMULATION FAILED\n" : "\nThe field produces a real race: greedy out at PUBLISH, adaptive leads.\n");
if (failed) process.exitCode = 1;
