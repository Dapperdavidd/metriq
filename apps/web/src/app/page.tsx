// apps/web/src/app/page.tsx
//
// The composition root. This is the ONE place that chooses the transport. Today it is
// the MockRunSource; in Phase 2 this single line becomes SseRunSource and no component
// below changes.

"use client";

import { useMemo } from "react";
import { createMockRunSource, MOCK_ROUND_ID } from "../feed/mock";
import { useRunFeed } from "../hooks/useRunFeed";
import { PitWall } from "../components/PitWall";

export default function Home() {
  const source = useMemo(() => createMockRunSource({ speed: 1 }), []);
  const state = useRunFeed(source);
  return <PitWall state={state} roundId={MOCK_ROUND_ID} />;
}
