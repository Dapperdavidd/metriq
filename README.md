# Metriq

Metered spending control for AI agents. A capped budget (a Tallo account), a router
that charges per subtask and declines in real time at the cap, a live ledger, and a
verifiable receipt per action. **Verso** is the flagship mode: four agents, four
identical budgets, one task, ranked live on value per dollar. One agent is capped out
live by real contract mechanics. The winner can prove it hit the target under cap
without revealing how.

Built for the OKX X Layer AI Agent hackathon. Submission gate 2026-07-17.

## The one law: decline, never revert

On an EVM chain a reverted transaction persists no logs. So the cap-out event cannot
live inside a transaction that reverts. `Tallo.charge()` returns `false` and emits
`CappedOut` on a cap breach; `TaskRouter.pay()` mirrors with `PaymentDeclined` and
returns `false`. Neither reverts. The event is the elimination, and it persists on
chain where the leaderboard derives from it.

## The rings

- **Ring 1 (must ship):** accounts, cap, router, live timing tower, clean cap-out, Copilot.
- **Ring 2 (likely):** Stubs, the verifiable receipts in the ledger rail.
- **Ring 3 (a decision at the July 12 checkpoint):** the Noir reveal.

## Layout

```
metriq/
  contracts/            Foundry, Solidity 0.8.24 (Tallo, TaskRouter, RevealVerifier)
  circuits/reveal/       Noir commit-reveal (Ring 3, behind the checkpoint)
  packages/
    core/               FROZEN: RunEvent, the shared reducer, the metric, the Stub fold
    strategies/          the four seeded spend policies (types now, policies in Phase 3)
  apps/
    web/                Next.js 15, the Pit Wall (Grid Ferme)
    host/               task host, SSE feed, indexer, Copilot route handlers
    orchestrator/        Node 20, drives the field, holds the operator key
```

## The spine: one shared reducer

The indexer produces `RunEvent`s. The frontend and the Copilot fold `RunEvent[]` into
`RunState` with the **same** pure reducer (`packages/core/src/reducer.ts`), so the
number on the tower and the number the Copilot narrates can never disagree. The mock
feed and the real chain indexer emit the identical `RunEvent` stream, so swapping them
is a transport change with zero UI change.

## Verify the core (no chain needed)

```bash
pnpm install
pnpm --filter @metriq/core gen:round   # folds the scripted round, asserts the drama
pnpm -r typecheck
```

The generator proves the ranking: Adaptive wins on the two-key metric, Conservative is
demoted below the target-reachers despite its higher raw value per OKB, and Greedy is
eliminated at PUBLISH. It also writes the canned round the frontend replays.

## House rules

- No em dashes anywhere (code, copy, comments, docs).
- TypeScript everywhere. Solidity for contracts, Noir for the circuit. No plain JavaScript.
- The Pit Wall is one screen: the timing tower (sport) and the ledger rail (statement).
- Never commit the operator key. Read `OPERATOR_KEY` from env at runtime only.

## Build phases

| Phase | Ships |
|-------|-------|
| 0 | Workspace scaffold, frozen `packages/core`, Grid Ferme tokens. **(done)** |
| 1A | Tallo + TaskRouter deployed, decline path proven with green tests. |
| 1B | Pit Wall on the mock feed, tower re-sort, cap-out takeover, Copilot line. |
| 2 | Indexer folds real events over SSE with replay. Mock to SSE swap. |
| 3 | Orchestrator drives four seeded agents through a real testnet round. |
| 4 | Ring 2 Stubs. Live Copilot call in front of the fallback. |
| 5 | Checkpoint decides Ring 3. Tuning, empty/error states, record the demo. |
