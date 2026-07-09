# Metriq — demo runbook

Three ways to run it, from zero-setup to fully on chain. All are free.

## Mode 1 — the mock (zero setup, the safe exhibition run)

The whole Pit Wall on the canned round. No chain, no keys, no network. This is the
pinned exhibition run: reproducible take after take, and the fallback if anything else
wobbles.

```bash
pnpm install
pnpm --filter @metriq/web dev      # http://localhost:3000
```

The tower re-sorts live, Greedy caps out red at PUBLISH, the ledger fills with Stub
receipts, the Copilot narrates, and (Ring 3) the winner gets the green PROVEN tick.

## Mode 2 — the full pipeline on a local chain (no testnet, no OKX)

Proves the real architecture end to end: real contracts, the orchestrator driving four
agents through real `pay()` transactions, the indexer folding chain logs, SSE to the
same UI. Needs Foundry (anvil).

```bash
bash scripts/e2e.sh        # in-process: contracts + orchestrator + indexer, asserts standings
bash scripts/e2e-sse.sh    # full 3-process: anvil + host (SSE) + orchestrator over HTTP
```

To watch it in the browser on the live chain feed: run `scripts/e2e-sse.sh` to bring up
anvil + the host, then in another shell start the web app pointed at SSE:

```bash
NEXT_PUBLIC_FEED=sse NEXT_PUBLIC_HOST_BASE=http://localhost:3001 \
  pnpm --filter @metriq/web dev
```

## Mode 3 — X Layer testnet (needs a funded throwaway key + OKX Payment SDK)

The one true deadline. This touches a live network, so it is yours to run.

```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url "$RPC_URL" --broadcast --private-key "$OPERATOR_KEY"
# copy the printed addresses into .env, then run the orchestrator + host as in Mode 2
```

## The Copilot (all optional, all free)

Default is the deterministic narrator: no key, works offline, reproducible. For a live
LLM, set one env path (see `.env.example`): Groq or Google AI Studio free tiers, local
Ollama, or a paid Anthropic key. Flip the UI to live with `NEXT_PUBLIC_COPILOT=live`.

---

## The 90-second script

| Time | Beat | What to say |
|------|------|-------------|
| 0:00 | The grid locks in. Four agents, four identical 1.00 OKB budgets, one task. | "Metered spending control for AI agents. Same budget, same task, ranked live on value per dollar." |
| 0:10 | Purchases stream in, the tower re-sorts, green flashes on improving lanes. | "Every purchase is a real on-chain charge. The tower is the ledger; lane order is the ranking." |
| 0:30 | Conservative leads early on raw efficiency; the Copilot notes the reserve. | "Conservative looks efficient, but it is underspending. The metric gates on the quality target, so watch what happens." |
| 0:45 | Adaptive and Balanced cross the target and overtake; Conservative drops to P3. | "Adaptive's knapsack planned one premium buy plus the VERIFY bonus. It leads on delivered value, not on doing the least." |
| 1:00 | **Greedy's cap declines at PUBLISH.** Lane turns red, ELIMINATED, metric struck through, survivors re-sort. | "Greedy chased raw score with no guard. The cap declines in real time. This is a real contract event, not an animation." |
| 1:10 | Open the tx on the X Layer explorer (or point at a Stub serial). | "Every number resolves to a tx. The CappedOut log is right there on chain." |
| 1:20 | The round settles, the ledger locks. The winner posts its Noir proof: green PROVEN tick. | "Parc ferme: the result stands. The winner proves it hit the target under cap, in zero knowledge, without revealing its route." |

## Fallback discipline

If the live re-sort or the chain wobbles, cut to Mode 1 (the mock). The contracts and
events stay real; only the pacing is pinned. Never let a flourish endanger the core run.
If Ring 3 is unstable, delete `apps/web/src/components/ProofTick.tsx` and drop the
`revealVerifier` address; nothing else changes.
