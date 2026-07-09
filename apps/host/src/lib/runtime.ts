// apps/host/src/lib/runtime.ts
//
// The host's shared runtime: one RunEventBus and one indexer per round, watching the
// chain. Everything off chain is stateless over the log, so the bus rebuilds the whole
// run from chain events and any SSE subscriber (even a late one) gets the full story
// via replay. Stashed on globalThis so it survives Next's module reloads.

import { RunEventBus, makePublicClient, watchRun, type IndexerAddresses } from "@metriq/chain";
import type { Hex } from "viem";

interface HostRuntime {
  bus: RunEventBus;
  watching: Map<string, () => void>;
}

const KEY = Symbol.for("metriq.host.runtime");
type GlobalWithRuntime = typeof globalThis & { [KEY]?: HostRuntime };

function runtime(): HostRuntime {
  const g = globalThis as GlobalWithRuntime;
  if (!g[KEY]) {
    g[KEY] = { bus: new RunEventBus(), watching: new Map() };
  }
  return g[KEY];
}

function addresses(): IndexerAddresses {
  const tallo = process.env.TALLO_ADDRESS;
  const taskRouter = process.env.TASK_ROUTER_ADDRESS;
  if (!tallo || !taskRouter) throw new Error("missing TALLO_ADDRESS / TASK_ROUTER_ADDRESS");
  return { tallo: tallo as Hex, taskRouter: taskRouter as Hex };
}

function chainConfig() {
  return {
    rpcUrl: process.env.RPC_URL ?? "http://127.0.0.1:8545",
    chainId: Number(process.env.CHAIN_ID ?? "31337"),
  };
}

export function bus(): RunEventBus {
  return runtime().bus;
}

// Lazily start indexing a round the first time it is subscribed to.
export function ensureWatching(roundId: string): void {
  const rt = runtime();
  if (rt.watching.has(roundId)) return;
  const publicClient = makePublicClient(chainConfig());
  const unwatch = watchRun(publicClient, addresses(), roundId, rt.bus);
  rt.watching.set(roundId, unwatch);
}
