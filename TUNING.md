# Metriq — tuning day (July 15)

The race is close by construction, not by luck. Three levers, one invariant set. All of
it is data-driven: change a number, re-run the simulator, read the outcome.

## The invariants to hold

1. **Greedy caps out at PUBLISH** (subtask 5), about two-thirds into the run.
2. **Adaptive finishes first** on value per OKB among the target-reachers.
3. **Conservative misses the quality target** (so it cannot win by underspending).
4. **Adaptive vs Conservative val/OKB gap stays within ~2**, so the race reads close.

## The levers

| Lever | Where | Effect |
|-------|-------|--------|
| Premium price, ENRICH (subtask 2) | `packages/core/src/tasks.ts`, `contracts/script/Deploy.s.sol` | Moves Balanced's spend and Greedy's cap-out point |
| Premium price, ANALYZE (subtask 3) | same | Moves Adaptive's spend; the main Adaptive-vs-Conservative gap dial |
| Quality target | `packages/core/src/metric.ts` (`QUALITY_TARGET`) | The line Conservative must miss and Adaptive/Balanced must clear |
| Knapsack horizon / Adaptive reserve | `packages/strategies/src/policies.ts` (`adaptive.knobs`) | One premium buy vs two; the winner's margin |
| Jitter seed / range | orchestrator env `JITTER_SEED`, `JITTER_MIN`, `JITTER_MAX` | Staggers payments so the tower visibly re-sorts; pin the seed for a fixed run |

## The workflow

Try a change without editing source, using env overrides on the simulator:

```bash
ANALYZE_PREMIUM=0.30 ENRICH_PREMIUM=0.28 QUALITY_TARGET=80 \
  pnpm --filter @metriq/strategies simulate
```

It prints the four invariants and the val/OKB gap, and fails loudly if the race breaks.
The default (0.28 / 0.30 / 80) gives a ~0.40 gap: a very close race. As a worked example,
bumping ANALYZE to 0.32 blows the gap to ~5.56 and flips Adaptive below Balanced, so the
tool rejects it.

When a set of numbers holds, write them into the three source locations above (they are
duplicated across TypeScript and Solidity because Solidity cannot import the TS table),
then confirm the mock re-derives cleanly:

```bash
pnpm --filter @metriq/core gen:round   # regenerates the canned round, re-asserts the drama
```

If the race genuinely cannot be made close, pin `JITTER_SEED` and ship the fixed
exhibition run. The contracts and events stay fully real; only the pacing is pinned.

## Open questions to confirm with the operator

- The exact quality target that gates the ranking (default 80).
- Final premium prices on subtasks 2 and 3 after tuning.
- Whether the Copilot ships live or deterministic (deterministic is the offline-safe default).
- Field size for the recording (four is default, six is the legible ceiling, two is the deadline fallback).
