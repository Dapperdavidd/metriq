// packages/core/scripts/gen-round.ts
//
// Generates the scripted demo round from the real rubric and prices, folds it
// through the shared reducer to assert the drama lands (Greedy caps at PUBLISH,
// Adaptive wins on the two-key metric), and writes the canned event stream the
// MockRunSource replays. Run: pnpm --filter @metriq/core gen:round

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SUBTASK_BY_ID,
  CAP_PER_AGENT,
  FIELD_ORDER,
  reduceRun,
  initialRun,
  rankLanes,
  type RunEvent,
  type Tier,
} from "../src/index";

interface Step {
  taskId: string;
  tier: Tier;
}
type Route = { agentId: string; steps: Step[]; capsAtLast: boolean };

const B: Tier = "BASE";
const P: Tier = "PREMIUM";

// Routes from the System Design route table, expressed against "The Briefing".
const ROUTES: Route[] = [
  {
    agentId: "adaptive", // premium ANALYZE only, plus VERIFY. The champion.
    steps: [
      { taskId: "0", tier: B },
      { taskId: "1", tier: B },
      { taskId: "2", tier: B },
      { taskId: "3", tier: P },
      { taskId: "4", tier: B },
      { taskId: "5", tier: B },
    ],
    capsAtLast: false,
  },
  {
    agentId: "balanced", // premium ENRICH only, plus VERIFY. Keeps P1 honest.
    steps: [
      { taskId: "0", tier: B },
      { taskId: "1", tier: B },
      { taskId: "2", tier: P },
      { taskId: "3", tier: B },
      { taskId: "4", tier: B },
      { taskId: "5", tier: B },
    ],
    capsAtLast: false,
  },
  {
    agentId: "conservative", // base everywhere, skips VERIFY. Finishes, scores low.
    steps: [
      { taskId: "0", tier: B },
      { taskId: "1", tier: B },
      { taskId: "2", tier: B },
      { taskId: "3", tier: B },
      { taskId: "5", tier: B },
    ],
    capsAtLast: false,
  },
  {
    agentId: "greedy", // premium everywhere, plus VERIFY. The cap stops it at PUBLISH.
    steps: [
      { taskId: "0", tier: B },
      { taskId: "1", tier: B },
      { taskId: "2", tier: P },
      { taskId: "3", tier: P },
      { taskId: "4", tier: B },
      { taskId: "5", tier: B }, // this one is declined, never charged
    ],
    capsAtLast: true,
  },
];

function priceOf(step: Step): bigint {
  const t = SUBTASK_BY_ID[step.taskId]!;
  return step.tier === "PREMIUM" && t.premiumPrice !== null ? t.premiumPrice : t.basePrice;
}

// PUBLISH earns a +5 bonus if VERIFY (subtask 4) was completed earlier.
function scoreOf(step: Step, hasVerify: boolean): number {
  const t = SUBTASK_BY_ID[step.taskId]!;
  if (step.taskId === "5") return t.baseScore + (hasVerify ? 5 : 0);
  return step.tier === "PREMIUM" && t.premiumPrice !== null ? t.premiumScore : t.baseScore;
}

function fakeHash(seed: number): string {
  return "0x" + seed.toString(16).padStart(64, "0");
}

interface TimedEvent {
  atMs: number;
  event: RunEvent;
}

function build(): { roundId: string; timed: TimedEvent[] } {
  const timed: TimedEvent[] = [];
  const capStr = CAP_PER_AGENT.toString();
  let hashSeed = 0x9f2c00;

  // OPEN and STAKE: identical budgets by construction, all at t0.
  for (const agentId of FIELD_ORDER) {
    timed.push({ atMs: 0, event: { kind: "opened", ts: 0, agentId, cap: capStr } });
  }

  // Per-agent stagger so the tower visibly re-sorts as purchases land out of step.
  const offset: Record<string, number> = { adaptive: 0, balanced: 220, conservative: 440, greedy: 660 };
  const STEP_GAP = 1100;

  for (const route of ROUTES) {
    const hasVerify = route.steps.some((s) => s.taskId === "4");
    let spent = 0n;
    let cumulative = 0;
    const base = 800 + (offset[route.agentId] ?? 0);

    route.steps.forEach((step, k) => {
      const at = base + k * STEP_GAP;
      const price = priceOf(step);
      const isLast = k === route.steps.length - 1;

      if (route.capsAtLast && isLast) {
        // The scripted decline: cap breach at PUBLISH. Decline then CappedOut, no charge.
        const remaining = CAP_PER_AGENT - spent;
        timed.push({
          atMs: at,
          event: {
            kind: "declined",
            ts: at,
            agentId: route.agentId,
            taskId: step.taskId,
            attempted: price.toString(),
            remaining: remaining.toString(),
          },
        });
        timed.push({
          atMs: at,
          event: { kind: "capped", ts: at, agentId: route.agentId, totalSpent: spent.toString() },
        });
        return;
      }

      spent += price;
      cumulative += scoreOf(step, hasVerify);
      const remaining = CAP_PER_AGENT - spent;
      const txHash = fakeHash(hashSeed++);

      // Charged and Stub land together, Charged first (money before receipt).
      timed.push({
        atMs: at,
        event: {
          kind: "charged",
          ts: at,
          agentId: route.agentId,
          amount: price.toString(),
          remaining: remaining.toString(),
        },
      });
      timed.push({
        atMs: at,
        event: {
          kind: "stub",
          ts: at,
          agentId: route.agentId,
          taskId: step.taskId,
          tier: step.tier,
          price: price.toString(),
          score: scoreOf(step, hasVerify),
          cumulativeScore: cumulative,
          txHash,
        },
      });
    });

    // Finishers report a final total (matches the cumulative from the stubs).
    if (!route.capsAtLast) {
      const lastAt = base + (route.steps.length - 1) * STEP_GAP + 400;
      timed.push({
        atMs: lastAt,
        event: { kind: "finished", ts: lastAt, agentId: route.agentId, totalScore: cumulative },
      });
    }
  }

  timed.sort((a, b) => a.atMs - b.atMs || 0);
  return { roundId: "0x3fa9", timed };
}

// ---- build, validate, write ----
const { roundId, timed } = build();

let state = initialRun;
for (const { event } of timed) state = reduceRun(state, event);

const ranked = rankLanes(state.lanes);
const order = ranked.map((l) => l.agentId).join(" > ");

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error("ASSERT FAILED:", msg);
    process.exitCode = 1;
  }
}

console.log("\nFinal standings:");
for (const l of ranked) {
  const flag = l.status === "eliminated" ? "OUT" : l.reachedTarget ? "TGT" : "   ";
  console.log(
    `  ${l.rank}. ${l.name.padEnd(13)} ${flag}  score ${String(l.score).padStart(3)}  ` +
      `spent ${(Number(l.spent) / 1e18).toFixed(2)}  val/OKB ${l.valuePerOkb.toFixed(2)}` +
      (l.reason ? `  (${l.reason})` : ""),
  );
}
console.log(`\nCopilot: "${state.copilotLine}"`);
console.log(`Phase: ${state.phase}  Stubs: ${state.stubs.length}\n`);

assert(order === "adaptive > balanced > conservative > greedy", `order was: ${order}`);
assert(state.lanes.find((l) => l.agentId === "greedy")?.status === "eliminated", "greedy must be eliminated");
assert(state.lanes.find((l) => l.agentId === "adaptive")?.rank === 1, "adaptive must be P1");
assert(state.lanes.find((l) => l.agentId === "conservative")?.reachedTarget === false, "conservative must miss target");
assert(state.phase === "settled", "round must settle");
assert(
  // adaptive 6, balanced 6, conservative 5, greedy 5 (its PUBLISH is declined, not a stub)
  state.stubs.length === 6 + 6 + 5 + 5,
  `stub count was ${state.stubs.length}`,
);
assert(state.copilotLine.includes("Adaptive"), "copilot should name the leader");

// Write the canned round for the frontend MockRunSource.
const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, "../../../apps/web/src/mock/round.canned.json");
mkdirSync(dirname(outPath), { recursive: true });
const canned = { roundId, events: timed.map((t) => ({ atMs: t.atMs, ...t.event })) };
writeFileSync(outPath, JSON.stringify(canned, null, 2) + "\n");
console.log(`Wrote ${timed.length} events to ${outPath}`);

if (process.exitCode) {
  console.error("\nVALIDATION FAILED\n");
} else {
  console.log("\nAll assertions passed. Core is consistent with the scripted drama.\n");
}
