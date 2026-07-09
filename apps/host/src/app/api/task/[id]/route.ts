// apps/host/src/app/api/task/[id]/route.ts
//
// The task host. Payment precedes work: the tx hash is the ticket. The host runs the
// subtask and returns the rubric quality as a DISPLAY ECHO and integrity check, not the
// source of truth: scoring is on chain from the posted table. 402 Payment Required when
// the paying tx is not found.

import { NextResponse, type NextRequest } from "next/server";
import { makePublicClient } from "@metriq/chain";
import { SUBTASK_BY_ID, type Tier } from "@metriq/core";
import type { Hex } from "viem";

interface TaskBody {
  roundId: string;
  agentId: string;
  txHash: Hex;
  tier: Tier;
}

function chainConfig() {
  return {
    rpcUrl: process.env.RPC_URL ?? "http://127.0.0.1:8545",
    chainId: Number(process.env.CHAIN_ID ?? "31337"),
  };
}

// The fixed, published rubric for a single subtask. Deterministic, no LLM. This is the
// display echo; the authoritative cumulative score (including the VERIFY bonus) is on
// chain in the Stub event.
function rubricQuality(taskId: string, tier: Tier): number {
  const spec = SUBTASK_BY_ID[taskId];
  if (!spec) return 0;
  return tier === "PREMIUM" && spec.premiumPrice !== null ? spec.premiumScore : spec.baseScore;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const spec = SUBTASK_BY_ID[id];
  if (!spec) return NextResponse.json({ error: "unknown subtask" }, { status: 404 });

  const body = (await req.json()) as TaskBody;

  // Payment precedes work: confirm the paying tx exists (the tx hash is the ticket).
  const client = makePublicClient(chainConfig());
  const receipt = await client
    .getTransactionReceipt({ hash: body.txHash })
    .catch(() => null);
  if (!receipt || receipt.status !== "success") {
    return NextResponse.json({ error: "payment not found" }, { status: 402 });
  }

  // Run the subtask. This is where a real service would produce the artifact; here the
  // deterministic rubric stands in, since quality is an echo, not the source of truth.
  const quality = rubricQuality(id, body.tier);

  return NextResponse.json({
    output: { subtask: spec.name, tier: body.tier, ok: true },
    quality,
  });
}
