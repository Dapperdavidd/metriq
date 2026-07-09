// apps/web/src/components/TimingTower.tsx
//
// Lane order IS the ranking. The rows re-sort with a short physical translate (about
// 220ms), not a celebration. Rendered as an ARIA table with aria-live so the standings
// are announced; the same semantics as a real table, with clean layout animation.

"use client";

import type { RunState } from "@metriq/core";
import { LaneRow } from "./LaneRow";
import styles from "./TimingTower.module.css";

export function TimingTower({ state }: { state: RunState }) {
  const fieldMax = Math.max(1, ...state.lanes.map((l) => l.valuePerOkb));

  return (
    <div className={styles.tower} role="table" aria-label="Live standings, value per OKB">
      <div className={styles.head} role="row">
        <span className={styles.headPos} role="columnheader">
          POS
        </span>
        <span className={styles.headName} role="columnheader">
          AGENT
        </span>
        <span className={styles.headMeter} role="columnheader">
          BUDGET
        </span>
        <span className={styles.headVal} role="columnheader">
          VAL / OKB
        </span>
      </div>

      <div className={styles.body} role="rowgroup" aria-live="polite" aria-relevant="all">
        {state.lanes.length === 0 ? (
          <div className={styles.empty} role="row">
            <span role="cell">Waiting for the grid to lock in.</span>
          </div>
        ) : (
          state.lanes.map((lane) => <LaneRow key={lane.agentId} lane={lane} fieldMax={fieldMax} />)
        )}
      </div>
    </div>
  );
}
