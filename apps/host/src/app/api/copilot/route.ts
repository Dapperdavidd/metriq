// apps/host/src/app/api/copilot/route.ts
//
// POST a RunSnapshot, get back one narrator line. Live Claude call when a key is
// present, deterministic fallback otherwise. The client debounces to at most one call
// per 4 seconds so inference never stalls the demo.

import { NextResponse, type NextRequest } from "next/server";
import type { RunSnapshot } from "@metriq/core";
import { readout } from "../../../lib/copilot";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const snapshot = (await req.json()) as RunSnapshot;
  const line = await readout(snapshot);
  return NextResponse.json({ line });
}
