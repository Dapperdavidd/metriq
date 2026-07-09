// apps/orchestrator/src/run.ts
//
// One process drives the whole field and holds the operator key (which owns the
// controller role, so it signs every pay). OPEN and STAKE give identical budgets by
// construction. In COMPETE each lane advances independently inside a Promise.all,
// while the actual contract writes serialise through the operator key via the mutex.

import { parseEventLogs, zeroHash, type Hex } from "viem";
import {
  agentIdHex,
  makePublicClient,
  makeWalletClient,
  roundIdHex,
  taskIdHex,
  taskRouterAbi,
  tierIndex,
} from "@metriq/chain";
import { SUBTASKS } from "@metriq/core";
import { STRATEGY_BY_NAME, type SpendDecision } from "@metriq/strategies";
import type { OrchestratorConfig } from "./config";
import { BRIEFING, contractsFor, type Contracts } from "./contracts";
import { Mutex, makeRng, sleep } from "./util";

type Logger = (msg: string) => void;

interface Deps {
  cfg: OrchestratorConfig;
  contracts: Contracts;
  publicClient: ReturnType<typeof makePublicClient>;
  writeLock: Mutex;
  round: Hex;
  operator: Hex;
  log: Logger;
}

async function seedBriefing(deps: Deps): Promise<void> {
  const { contracts, round, writeLock, publicClient } = deps;
  for (const s of SUBTASKS) {
    const bonusTaskId = s.id === "5" ? taskIdHex("4") : zeroHash;
    const bonusScore = s.id === "5" ? 5 : 0;
    const task = {
      basePrice: s.basePrice,
      premiumPrice: s.premiumPrice ?? 0n,
      baseScore: s.baseScore,
      premiumScore: s.premiumScore,
      bonusTaskId,
      bonusScore,
      required: s.required,
      exists: false,
    } as const;
    const hash = await writeLock.run(() =>
      contracts.router.write.listTask([round, taskIdHex(s.id), task]),
    );
    await publicClient.waitForTransactionReceipt({ hash });
  }
  deps.log(`seeded ${SUBTASKS.length} subtasks for round ${deps.cfg.roundId}`);
}

async function payAndExecute(deps: Deps, agentId: string, decision: SpendDecision): Promise<boolean> {
  if (!decision) return false;
  const { contracts, round, writeLock, publicClient, cfg } = deps;

  const hash = await writeLock.run(() =>
    contracts.router.write.pay([
      round,
      agentIdHex(agentId),
      taskIdHex(decision.taskId),
      tierIndex(decision.tier),
    ]),
  );
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  const declined =
    parseEventLogs({ abi: taskRouterAbi, logs: receipt.logs, eventName: "PaymentDeclined" }).length > 0;
  if (declined) {
    deps.log(`${agentId} DECLINED at ${decision.taskId} (cap breach) -> lane done`);
    return false;
  }

  // Optional host integrity echo: payment precedes work, the tx hash is the ticket.
  if (cfg.hostBase) {
    try {
      await fetch(`${cfg.hostBase}/api/task/${decision.taskId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roundId: cfg.roundId, agentId, txHash: hash, tier: decision.tier }),
      });
    } catch {
      // the host echo is an integrity check, not the source of truth; ignore failures
    }
  }

  deps.log(`${agentId} paid ${decision.taskId} ${decision.tier}`);
  return true;
}

async function driveLane(deps: Deps, agentId: string): Promise<void> {
  const { contracts, round, cfg } = deps;
  const strategy = STRATEGY_BY_NAME[agentId];
  if (!strategy) {
    deps.log(`no strategy for ${agentId}, skipping`);
    return;
  }

  const rng = makeRng(deps.cfg.jitterSeed ^ hashName(agentId));
  const jitter = () => cfg.jitterMin + Math.floor(rng() * (cfg.jitterMax - cfg.jitterMin));
  const completed = new Set<string>();

  for (;;) {
    await sleep(jitter()); // the pacing lever
    const [cap, spent, active] = await contracts.tallo.read.accountOf([round, agentIdHex(agentId)]);
    if (!active) break; // capped out or settled

    const decision = strategy.decide({
      roundId: cfg.roundId,
      agentId,
      cap,
      spent,
      remaining: BRIEFING.filter((t) => !completed.has(t.id)),
      completed,
    });
    if (decision === null) break; // strategy is done

    const ok = await payAndExecute(deps, agentId, decision);
    if (!ok) break;
    completed.add(decision.taskId);
  }

  const hash = await deps.writeLock.run(() => contracts.router.write.finish([round, agentIdHex(agentId)]));
  await deps.publicClient.waitForTransactionReceipt({ hash });
  deps.log(`${agentId} finished`);
}

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  return h;
}

export async function runVerso(cfg: OrchestratorConfig, log: Logger = console.log): Promise<void> {
  const publicClient = makePublicClient(cfg);
  const walletClient = makeWalletClient(cfg, cfg.operatorKey);
  const operator = walletClient.account.address;
  const contracts = contractsFor(cfg.tallo, cfg.taskRouter, publicClient, walletClient);
  const round = roundIdHex(cfg.roundId);
  const writeLock = new Mutex();
  const deps: Deps = { cfg, contracts, publicClient, writeLock, round, operator, log };

  log(`operator ${operator} driving ${cfg.field.length} agents on round ${cfg.roundId}`);

  await seedBriefing(deps);

  // OPEN + STAKE: identical budgets by construction.
  for (const agentId of cfg.field) {
    const openHash = await writeLock.run(() =>
      contracts.tallo.write.openAccount([round, agentIdHex(agentId)], { value: cfg.capEach }),
    );
    await publicClient.waitForTransactionReceipt({ hash: openHash });
    const ctrlHash = await writeLock.run(() =>
      contracts.router.write.assignController([round, agentIdHex(agentId), operator]),
    );
    await publicClient.waitForTransactionReceipt({ hash: ctrlHash });
  }
  log(`opened + staked ${cfg.field.length} accounts at ${Number(cfg.capEach) / 1e18} OKB each`);

  // COMPETE: each lane advances independently; writes queue through the operator key.
  await Promise.all(cfg.field.map((agentId) => driveLane(deps, agentId)));

  log("round complete");
}
