// apps/web/src/feed/source.ts
//
// The one indirection that makes mock-first work. The client subscribes through this
// thin interface. MockRunSource and SseRunSource are interchangeable at the
// composition root: swapping them is a transport change with zero UI change, because
// both emit the identical RunEvent stream.

import type { RunEvent } from "@metriq/core";

export interface RunSource {
  subscribe(onEvent: (e: RunEvent) => void): () => void; // returns an unsubscribe
}
