// packages/chain/src/indexer.ts
//
// The indexer: viem on X Layer (or anvil) mapped to the frozen RunEvent stream. This is
// the real half of the mock/real pair. It emits the identical events the MockRunSource
// emits, so the same reducer and the same UI light up whether the source is canned or
// on chain.
//
// It backfills historical logs (so a late-starting indexer, or a late SSE joiner, still
// gets the whole run) and then watches live, deduping by (blockNumber, logIndex) so the
// boundary between backfill and live never double-counts.

import type { Abi, Hex, Log } from "viem";
import type { RunEvent } from "@metriq/core";
import { talloAbi, taskRouterAbi } from "./abi";
import type { makePublicClient } from "./client";
import { decodeStringId, roundIdHex, tierFromIndex } from "./ids";
import type { RunEventBus } from "./bus";

export interface IndexerAddresses {
  tallo: Hex;
  taskRouter: Hex;
}

type PublicClientLike = ReturnType<typeof makePublicClient>;

// viem types indexed event args per event; this indexer is generic over the event
// name, so args are read permissively and converted to the exact RunEvent shape in each
// mapper. This is the one place a loose type is warranted: every conversion is explicit
// and the RunEvent output is fully typed.
type Args = Record<string, any>;
type Mapper = (args: Args, log: Log) => RunEvent;

interface EventSpec {
  address: Hex;
  abi: Abi;
  eventName: string;
  map: Mapper;
}

export function watchRun(
  publicClient: PublicClientLike,
  addr: IndexerAddresses,
  roundId: string,
  bus: RunEventBus,
  pollingInterval = 250,
): () => void {
  const round = roundIdHex(roundId);

  const specs: EventSpec[] = [
    {
      address: addr.tallo,
      abi: talloAbi as unknown as Abi,
      eventName: "AccountOpened",
      map: (a) => ({ kind: "opened", ts: 0, agentId: decodeStringId(a.agentId), cap: a.cap.toString() }),
    },
    {
      address: addr.tallo,
      abi: talloAbi as unknown as Abi,
      eventName: "Charged",
      map: (a) => ({
        kind: "charged",
        ts: 0,
        agentId: decodeStringId(a.agentId),
        amount: a.amount.toString(),
        remaining: a.remaining.toString(),
      }),
    },
    {
      address: addr.tallo,
      abi: talloAbi as unknown as Abi,
      eventName: "CappedOut",
      map: (a) => ({ kind: "capped", ts: 0, agentId: decodeStringId(a.agentId), totalSpent: a.totalSpent.toString() }),
    },
    {
      address: addr.taskRouter,
      abi: taskRouterAbi as unknown as Abi,
      eventName: "Stub",
      map: (a, log) => ({
        kind: "stub",
        ts: 0,
        agentId: decodeStringId(a.agentId),
        taskId: decodeStringId(a.taskId),
        tier: tierFromIndex(Number(a.tier)),
        price: a.price.toString(),
        score: Number(a.score),
        cumulativeScore: Number(a.cumulativeScore),
        txHash: log.transactionHash ?? undefined,
      }),
    },
    {
      address: addr.taskRouter,
      abi: taskRouterAbi as unknown as Abi,
      eventName: "PaymentDeclined",
      map: (a) => ({
        kind: "declined",
        ts: 0,
        agentId: decodeStringId(a.agentId),
        taskId: decodeStringId(a.taskId),
        attempted: "0",
        remaining: "0",
      }),
    },
    {
      address: addr.taskRouter,
      abi: taskRouterAbi as unknown as Abi,
      eventName: "RunFinished",
      map: (a) => ({ kind: "finished", ts: 0, agentId: decodeStringId(a.agentId), totalScore: Number(a.totalScore) }),
    },
  ];

  const seen = new Set<string>();
  const keyOf = (log: Log): string => `${log.blockNumber}:${log.logIndex}`;
  const pushLog = (spec: EventSpec, log: Log): void => {
    const key = keyOf(log);
    if (seen.has(key)) return;
    seen.add(key);
    bus.push(roundId, spec.map((log as unknown as { args: Args }).args, log));
  };

  // Backfill: pull the run so far, sorted into chain order, before going live.
  void (async () => {
    const historical: Array<{ spec: EventSpec; log: Log }> = [];
    for (const spec of specs) {
      const logs = await publicClient
        .getContractEvents({
          address: spec.address,
          abi: spec.abi,
          eventName: spec.eventName,
          args: { roundId: round },
          fromBlock: 0n,
          toBlock: "latest",
        })
        .catch(() => [] as Log[]);
      for (const log of logs as Log[]) historical.push({ spec, log });
    }
    historical.sort((a, b) => {
      const bn = Number((a.log.blockNumber ?? 0n) - (b.log.blockNumber ?? 0n));
      return bn !== 0 ? bn : (a.log.logIndex ?? 0) - (b.log.logIndex ?? 0);
    });
    for (const { spec, log } of historical) pushLog(spec, log);
  })();

  // Live: watch each event and push, deduped against the backfill.
  const unwatchers = specs.map((spec) =>
    publicClient.watchContractEvent({
      address: spec.address,
      abi: spec.abi,
      eventName: spec.eventName,
      args: { roundId: round },
      pollingInterval,
      onLogs: (logs) => (logs as Log[]).forEach((log) => pushLog(spec, log)),
    }),
  );

  return () => unwatchers.forEach((u) => u());
}
