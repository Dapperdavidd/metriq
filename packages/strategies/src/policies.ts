// packages/strategies/src/policies.ts
//
// The four seeds. Each is a PURE function of run context: no LLM in the decision loop,
// which is what makes the demo reproducible take after take. All four are under
// operator control, so the race is close by construction and the cap-out lands on cue.
//
// Note on tuning: the exact spend/score each policy lands (the July-15 targets of
// roughly Adaptive 88, Balanced 85, Conservative 57) is set by the knobs and the
// premium prices on ENRICH and ANALYZE, not by the policy shape. These implementations
// are the faithful seeds; tuning day dials the numbers.

import type { RoundState, SpendDecision, Strategy, Task } from "./types";
import { knapsack, itemPrice } from "./knapsack";

const PUBLISH = "5";
const VERIFY = "4";
const ENRICH = "2";

function reserveWei(cap: bigint, reserve: number): bigint {
  return (cap * BigInt(Math.round(reserve * 1_000_000))) / 1_000_000n;
}

function priceOf(t: Task, premium: boolean): bigint {
  return premium && t.premiumPrice !== null ? t.premiumPrice : t.basePrice;
}

function scoreOf(t: Task, premium: boolean): number {
  return premium && t.premiumPrice !== null ? t.premiumScore : t.baseScore;
}

function vpd(t: Task, premium: boolean): number {
  const okb = Number(priceOf(t, premium)) / 1e18;
  return okb > 0 ? scoreOf(t, premium) / okb : 0;
}

// 1) GREEDY: chases raw score, buys the premium tier of everything, no reserve. It
// walks the subtasks in order so the required PUBLISH is attempted last, where the cap
// stops it. No self-preservation: the elimination is the scripted beat.
export const greedy: Strategy = {
  name: "greedy",
  displayColor: "var(--lane-red)",
  knobs: { reserve: 0, greed: 1, horizon: 0 },
  decide(s: RoundState): SpendDecision {
    const next = [...s.remaining].sort((a, b) => Number(a.id) - Number(b.id))[0];
    if (!next) return null;
    return { taskId: next.id, tier: next.premiumPrice !== null ? "PREMIUM" : "BASE" };
  },
};

// 2) CONSERVATIVE: cheapest required task first, base tier only, skips the optional
// VERIFY, hoards budget behind a fat reserve. Finishes, scores lowest.
export const conservative: Strategy = {
  name: "conservative",
  displayColor: "var(--lane-slate)",
  knobs: { reserve: 0.25, greed: 0, horizon: 0 },
  decide(s: RoundState): SpendDecision {
    const budget = s.cap - s.spent - reserveWei(s.cap, this.knobs.reserve);
    const required = s.remaining.filter((t) => t.required && t.basePrice <= budget);
    const cheapest = required.sort((a, b) => Number(a.basePrice - b.basePrice))[0];
    return cheapest ? { taskId: cheapest.id, tier: "BASE" } : null;
  },
};

// 3) BALANCED: best value per dollar first, one planned premium ENRICH splurge, a thin
// reserve. It defers PUBLISH until VERIFY is done so the +5 bonus lands. Finishes near
// the top.
export const balanced: Strategy = {
  name: "balanced",
  displayColor: "var(--lane-green)",
  knobs: { reserve: 0.05, greed: 0.3, horizon: 0 },
  decide(s: RoundState): SpendDecision {
    const budget = s.cap - s.spent - reserveWei(s.cap, this.knobs.reserve);

    const candidates = s.remaining
      .map((t) => ({ task: t, premium: t.id === ENRICH && t.premiumPrice !== null }))
      .filter((c) => priceOf(c.task, c.premium) <= budget || (c.task.required && priceOf(c.task, c.premium) <= s.cap - s.spent));

    // Defer PUBLISH while VERIFY is still on the board, to capture the bonus.
    const verifyPending = s.remaining.some((t) => t.id === VERIFY);
    let pool = verifyPending ? candidates.filter((c) => c.task.id !== PUBLISH) : candidates;
    if (pool.length === 0) pool = candidates;

    const pick = pool.sort((a, b) => vpd(b.task, b.premium) - vpd(a.task, a.premium))[0];
    return pick ? { taskId: pick.task.id, tier: pick.premium ? "PREMIUM" : "BASE" } : null;
  },
};

// 4) ADAPTIVE: a bounded 0/1 knapsack over remaining budget each tick. The champion:
// it plans a route rather than reacting. Buys VERIFY before PUBLISH when the plan wants
// the bonus, and decides its one premium buy vs two by the horizon knob.
export const adaptive: Strategy = {
  name: "adaptive",
  displayColor: "var(--lane-purple)",
  knobs: { reserve: 0.02, greed: 0.2, horizon: 4 },
  decide(s: RoundState): SpendDecision {
    const budget = s.cap - s.spent - reserveWei(s.cap, this.knobs.reserve);
    const plan = knapsack(s.remaining, budget, this.knobs.horizon);
    if (plan.length === 0) return null;

    // Sequence the plan so any task that unlocks a bonus (VERIFY) is bought before the
    // task it unlocks (PUBLISH). Otherwise take the cheapest planned step first to keep
    // the most budget flexibility for the next recompute.
    const hasVerifyPlanned = plan.some((it) => it.task.id === VERIFY);
    const ordered = [...plan].sort((a, b) => {
      if (hasVerifyPlanned) {
        if (a.task.id === VERIFY && b.task.id === PUBLISH) return -1;
        if (a.task.id === PUBLISH && b.task.id === VERIFY) return 1;
      }
      return Number(itemPrice(a) - itemPrice(b));
    });

    const first = ordered[0]!;
    return { taskId: first.task.id, tier: first.premium ? "PREMIUM" : "BASE" };
  },
};

export const FIELD: readonly Strategy[] = [adaptive, balanced, conservative, greedy];

export const STRATEGY_BY_NAME: Readonly<Record<string, Strategy>> = Object.fromEntries(
  FIELD.map((s) => [s.name, s]),
);
