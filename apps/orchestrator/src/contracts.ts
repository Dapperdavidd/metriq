// apps/orchestrator/src/contracts.ts
//
// viem contract handles and the shared briefing task list. The strategies decide over
// this task list; the orchestrator seeds the same table on chain via listTask.

import { getContract } from "viem";
import { makePublicClient, makeWalletClient, talloAbi, taskRouterAbi } from "@metriq/chain";
import { SUBTASKS } from "@metriq/core";
import type { Task } from "@metriq/strategies";

type PublicClientLike = ReturnType<typeof makePublicClient>;
type WalletClientLike = ReturnType<typeof makeWalletClient>;

export function contractsFor(
  talloAddress: `0x${string}`,
  routerAddress: `0x${string}`,
  publicClient: PublicClientLike,
  walletClient: WalletClientLike,
) {
  const client = { public: publicClient, wallet: walletClient } as const;
  const tallo = getContract({ address: talloAddress, abi: talloAbi, client });
  const router = getContract({ address: routerAddress, abi: taskRouterAbi, client });
  return { tallo, router };
}

export type Contracts = ReturnType<typeof contractsFor>;

// The Briefing as the strategies' decision task list, mirrored from the frozen core.
export const BRIEFING: Task[] = SUBTASKS.map((s) => ({
  id: s.id,
  basePrice: s.basePrice,
  premiumPrice: s.premiumPrice,
  baseScore: s.baseScore,
  premiumScore: s.premiumScore,
  required: s.required,
}));
