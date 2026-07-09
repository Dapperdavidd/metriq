// apps/host/src/app/api/round/[roundId]/stream/route.ts
//
// SSE with replay. One-directional, replayable, survives venue wifi, zero extra infra.
// A late joiner gets the whole run replayed from block 0, then live events. The client
// never polls. This is the transport half of the mock/real pair: SseRunSource wraps
// this endpoint and emits the identical RunEvent stream the mock does.

import type { NextRequest } from "next/server";
import type { RunEvent } from "@metriq/core";
import { bus, ensureWatching } from "../../../../../lib/runtime";

export const dynamic = "force-dynamic"; // never cache a live stream

export async function GET(_req: NextRequest, { params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  ensureWatching(roundId);
  const feed = bus();

  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      const send = (e: RunEvent) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          // stream already closed
        }
      };
      // a comment line keeps some proxies from buffering the stream
      controller.enqueue(enc.encode(": connected\n\n"));
      // replay the run so far, then subscribe to live events
      feed.replay(roundId).forEach(send);
      unsubscribe = feed.subscribe(roundId, send);
    },
    cancel() {
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
