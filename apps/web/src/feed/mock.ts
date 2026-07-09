// apps/web/src/feed/mock.ts
//
// MockRunSource replays the canned round (an ordered list of RunEvents, each with an
// atMs) on a timer. The whole UI is built and perfected on this. No chain required.
// The canned file is generated from the real rubric by packages/core gen:round, so
// the mock cannot drift from the on-chain scoring.

import type { RunEvent } from "@metriq/core";
import canned from "../mock/round.canned.json";
import type { RunSource } from "./source";

type TimedEvent = RunEvent & { atMs: number };

export interface MockOptions {
  speed?: number; // 1 == the authored pacing; 2 == twice as fast
}

export function createMockRunSource(opts: MockOptions = {}): RunSource {
  const speed = opts.speed && opts.speed > 0 ? opts.speed : 1;
  const events = (canned.events as TimedEvent[]).slice();

  return {
    subscribe(onEvent) {
      const timers: ReturnType<typeof setTimeout>[] = [];
      for (const timed of events) {
        const { atMs, ...event } = timed;
        const delay = Math.max(0, atMs / speed);
        timers.push(setTimeout(() => onEvent(event as RunEvent), delay));
      }
      return () => {
        for (const t of timers) clearTimeout(t);
      };
    },
  };
}

export const MOCK_ROUND_ID: string = canned.roundId;
