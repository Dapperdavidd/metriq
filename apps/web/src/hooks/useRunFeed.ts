// apps/web/src/hooks/useRunFeed.ts
//
// The reducer hook. It runs the SAME pure fold the backend uses (reduceRun from the
// frozen core) over whatever RunSource it is given. Because the tower and the Copilot
// both read this RunState, their numbers can never disagree.

"use client";

import { useEffect, useReducer } from "react";
import { initialRun, reduceRun, type RunState } from "@metriq/core";
import type { RunSource } from "../feed/source";

export function useRunFeed(source: RunSource): RunState {
  const [state, dispatch] = useReducer(reduceRun, initialRun);

  useEffect(() => {
    const unsubscribe = source.subscribe((event) => dispatch(event));
    return unsubscribe;
  }, [source]);

  return state;
}
