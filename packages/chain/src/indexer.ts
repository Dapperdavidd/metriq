// packages/chain/src/indexer.ts
//
// The indexer: viem watchContractEvent on X Layer (or anvil) mapped to the frozen
// RunEvent stream. This is the real half of the mock/real pair. It emits the identical
// events the MockRunSource emits, so the same reducer and the same UI light up whether
// the source is canned or on chain.

import type { Hex, Log } from "viem";
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

// viem types indexed event args per event; the watcher here is generic over the event
// name, so args are read permissively and converted to the exact RunEvent shape below.
// This is the one place a loose type is warranted: the conversions are explicit and the
// RunEvent output is fully typed.
type Args = Record<string, any>;

export function watchRun(
  publicClient: PublicClientLike,
  addr: IndexerAddresses,
  roundId: string,
  bus: RunEventBus,
  pollingInterval = 250,
): () => void {
  const round = roundIdHex(roundId);
  const push = (e: RunEvent) => bus.push(roundId, e);
  const unwatchers: Array<() => void> = [];

  const onTallo = (map: (a: Args, log: Log) => RunEvent, eventName: string) =>
    unwatchers.push(
      publicClient.watchContractEvent({
        address: addr.tallo,
        abi: talloAbi,
        eventName: eventName as "AccountOpened",
        args: { roundId: round },
        pollingInterval,
        onLogs: (logs) => logs.forEach((l) => push(map((l as unknown as { args: Args }).args, l))),
      }),
    );

  const onRouter = (map: (a: Args, log: Log) => RunEvent, eventName: string) =>
    unwatchers.push(
      publicClient.watchContractEvent({
        address: addr.taskRouter,
        abi: taskRouterAbi,
        eventName: eventName as "Stub",
        args: { roundId: round },
        pollingInterval,
        onLogs: (logs) => logs.forEach((l) => push(map((l as unknown as { args: Args }).args, l))),
      }),
    );

  onTallo(
    (a) => ({ kind: "opened", ts: 0, agentId: decodeStringId(a.agentId), cap: a.cap.toString() }),
    "AccountOpened",
  );
  onTallo(
    (a) => ({
      kind: "charged",
      ts: 0,
      agentId: decodeStringId(a.agentId),
      amount: a.amount.toString(),
      remaining: a.remaining.toString(),
    }),
    "Charged",
  );
  onTallo(
    (a) => ({ kind: "capped", ts: 0, agentId: decodeStringId(a.agentId), totalSpent: a.totalSpent.toString() }),
    "CappedOut",
  );

  onRouter(
    (a, log) => ({
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
    "Stub",
  );
  onRouter(
    (a) => ({
      kind: "declined",
      ts: 0,
      agentId: decodeStringId(a.agentId),
      taskId: decodeStringId(a.taskId),
      attempted: "0",
      remaining: "0",
    }),
    "PaymentDeclined",
  );
  onRouter(
    (a) => ({ kind: "finished", ts: 0, agentId: decodeStringId(a.agentId), totalScore: Number(a.totalScore) }),
    "RunFinished",
  );

  return () => unwatchers.forEach((u) => u());
}
