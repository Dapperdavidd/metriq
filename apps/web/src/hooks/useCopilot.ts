// apps/web/src/hooks/useCopilot.ts
//
// The Copilot line the UI shows. Off by default (deterministic line from the reducer,
// fully offline). With NEXT_PUBLIC_COPILOT=live it POSTs the snapshot to the host, at
// most once per ~4s of quiet (a trailing debounce keyed on leaderboard shifts), and
// shows the live line when it arrives. It always falls back to the deterministic line,
// so the surface never goes blank.

"use client";

import { useEffect, useRef, useState } from "react";
import { type RunState, toSnapshot } from "@metriq/core";

const ENABLED = process.env.NEXT_PUBLIC_COPILOT === "live";
const HOST_BASE = process.env.NEXT_PUBLIC_HOST_BASE ?? "";
const DEBOUNCE_MS = 4000;

export function useCopilot(state: RunState): string {
  const [liveLine, setLiveLine] = useState("");
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => {
    if (!ENABLED) return;
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`${HOST_BASE}/api/copilot`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(toSnapshot(latest.current)),
        });
        const data = (await res.json()) as { line?: string };
        if (data.line) setLiveLine(data.line);
      } catch {
        // keep the deterministic line
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
    // re-armed on every leaderboard shift; the debounce collapses bursts to one call
  }, [state.copilotLine]);

  if (!ENABLED) return state.copilotLine;
  return liveLine || state.copilotLine;
}
