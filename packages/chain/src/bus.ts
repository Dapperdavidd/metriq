// packages/chain/src/bus.ts
//
// The in-memory event bus. Everything off chain is stateless over the log: the bus
// keeps an ordered replay log per round and fans events to subscribers. Late joiners
// get the whole run via replay, then live events. Timestamps are stamped relative to
// the round's first event, matching the mock's atMs semantics so the two feeds are
// truly interchangeable.

import type { RunEvent } from "@metriq/core";

type Handler = (e: RunEvent) => void;

export class RunEventBus {
  private readonly logs = new Map<string, RunEvent[]>();
  private readonly subs = new Map<string, Set<Handler>>();
  private readonly starts = new Map<string, number>();

  push(roundId: string, event: RunEvent): RunEvent {
    const now = Date.now();
    if (!this.starts.has(roundId)) this.starts.set(roundId, now);
    const ts = now - (this.starts.get(roundId) ?? now);
    const stamped = { ...event, ts } as RunEvent;

    let log = this.logs.get(roundId);
    if (!log) {
      log = [];
      this.logs.set(roundId, log);
    }
    log.push(stamped);

    this.subs.get(roundId)?.forEach((h) => h(stamped));
    return stamped;
  }

  replay(roundId: string): readonly RunEvent[] {
    return this.logs.get(roundId) ?? [];
  }

  subscribe(roundId: string, handler: Handler): () => void {
    let set = this.subs.get(roundId);
    if (!set) {
      set = new Set();
      this.subs.set(roundId, set);
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
    };
  }
}
