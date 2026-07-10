// apps/web/src/app/arena/page.tsx
//
// The arena: the live Pit Wall. This is the ONE place that chooses the transport.
// Everything below reads the same RunState from the same reducer, so flipping the
// source is a transport change with zero component change.
//
//   NEXT_PUBLIC_FEED = mock (default) | sse
//   NEXT_PUBLIC_ROUND_ID = the round to watch when on sse

"use client";

import { useMemo } from "react";
import type { RunSource } from "../../feed/source";
import { createMockRunSource, MOCK_ROUND_ID } from "../../feed/mock";
import { createSseRunSource } from "../../feed/sse";
import { useRunFeed } from "../../hooks/useRunFeed";
import { PitWall } from "../../components/PitWall";

const FEED = process.env.NEXT_PUBLIC_FEED ?? "mock";
const ROUND_ID = process.env.NEXT_PUBLIC_ROUND_ID ?? MOCK_ROUND_ID;

export default function Arena() {
  const roundId = FEED === "sse" ? ROUND_ID : MOCK_ROUND_ID;
  const source: RunSource = useMemo(
    () => (FEED === "sse" ? createSseRunSource(ROUND_ID) : createMockRunSource({ speed: 1 })),
    [],
  );
  const state = useRunFeed(source);
  return <PitWall state={state} roundId={roundId} />;
}
