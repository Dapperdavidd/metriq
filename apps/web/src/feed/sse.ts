// apps/web/src/feed/sse.ts
//
// SseRunSource: the real transport. It wraps EventSource over the host's SSE endpoint
// and parses each message into a RunEvent. The indexer emits the identical events the
// mock does, and the endpoint replays from block 0 of the run, so a late joiner still
// gets the whole story. This is interchangeable with MockRunSource at the composition
// root: swapping them is a transport change with zero UI change.

import type { RunEvent } from "@metriq/core";
import type { RunSource } from "./source";

// The host runs as a separate process (default port 3001). Point the client at it with
// NEXT_PUBLIC_HOST_BASE; empty means same origin.
const HOST_BASE = process.env.NEXT_PUBLIC_HOST_BASE ?? "";

export function createSseRunSource(roundId: string): RunSource {
  return {
    subscribe(onEvent: (e: RunEvent) => void) {
      const url = `${HOST_BASE}/api/round/${roundId}/stream`;
      const es = new EventSource(url);

      es.onmessage = (m) => {
        try {
          onEvent(JSON.parse(m.data) as RunEvent);
        } catch {
          // ignore a malformed frame rather than tear down the feed
        }
      };

      es.onerror = () => {
        // surface a feed-lost beat; the reducer flags it and the UI can show it. The
        // browser will attempt to reconnect on its own.
        onEvent({ kind: "feed-lost", ts: Date.now() });
      };

      return () => es.close();
    },
  };
}
