// apps/orchestrator/src/config.ts
//
// All configuration is read from env at runtime. The operator key is never hardcoded
// and never logged. Sensible defaults target a local anvil node so the whole pipeline
// runs with zero setup.

import type { Hex } from "viem";
import { CAP_PER_AGENT, FIELD_ORDER } from "@metriq/core";

export interface OrchestratorConfig {
  rpcUrl: string;
  chainId: number;
  operatorKey: Hex;
  tallo: Hex;
  taskRouter: Hex;
  roundId: string;
  capEach: bigint;
  hostBase?: string;
  jitterSeed: number;
  jitterMin: number;
  jitterMax: number;
  field: string[];
}

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`missing env ${name}`);
  return value;
}

export function loadConfig(): OrchestratorConfig {
  const env = process.env;
  return {
    rpcUrl: env.RPC_URL ?? "http://127.0.0.1:8545",
    chainId: Number(env.CHAIN_ID ?? "31337"),
    operatorKey: required("OPERATOR_KEY", env.OPERATOR_KEY) as Hex,
    tallo: required("TALLO_ADDRESS", env.TALLO_ADDRESS) as Hex,
    taskRouter: required("TASK_ROUTER_ADDRESS", env.TASK_ROUTER_ADDRESS) as Hex,
    roundId: env.ROUND_ID ?? "0x3fa9",
    capEach: env.CAP_EACH ? BigInt(env.CAP_EACH) : CAP_PER_AGENT,
    hostBase: env.HOST_BASE || undefined,
    jitterSeed: Number(env.JITTER_SEED ?? "1337"),
    jitterMin: Number(env.JITTER_MIN ?? "300"),
    jitterMax: Number(env.JITTER_MAX ?? "900"),
    field: (env.FIELD ? env.FIELD.split(",") : [...FIELD_ORDER]).map((s) => s.trim()),
  };
}
