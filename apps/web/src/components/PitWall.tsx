// apps/web/src/components/PitWall.tsx
//
// The one screen. Timing tower (the sport) on the left, ledger rail (the statement)
// on the right, one shared 1px ink rule between them. Two halves of the same truth.

"use client";

import type { RunState } from "@metriq/core";
import { clockLabel } from "../lib/accent";
import { TimingTower } from "./TimingTower";
import { LedgerRail } from "./LedgerRail";
import styles from "./PitWall.module.css";

export function PitWall({ state, roundId }: { state: RunState; roundId: string }) {
  const locked = state.phase === "settled";
  const live = state.phase === "live";

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.wordmark}>Metriq</span>
          <span className={styles.mode}>/ VERSO</span>
          <span className={`${styles.round} mono`}>ROUND {roundId.toUpperCase()}</span>
        </div>
        <div className={styles.status}>
          <span
            className={`${styles.state} ${locked ? styles.stateLocked : live ? styles.stateLive : styles.stateIdle}`}
          >
            <span className={styles.dot} aria-hidden />
            {locked ? "LOCKED" : live ? "LIVE" : "STAGED"}
          </span>
          <span className={`${styles.clock} mono`}>{clockLabel(state.clock)}</span>
          <span className={styles.metricLabel}>VAL / OKB</span>
        </div>
      </header>

      <div className={styles.split}>
        <section className={styles.towerPane} aria-label="Timing tower">
          <TimingTower state={state} />
        </section>
        <div className={styles.rule} aria-hidden />
        <aside className={styles.railPane} aria-label="Ledger rail">
          <LedgerRail state={state} roundId={roundId} />
        </aside>
      </div>

      {locked && (
        <div className={styles.lockStamp} role="status">
          PARC FERME · THE LEDGER IS LOCKED · THE RESULT STANDS
        </div>
      )}
    </div>
  );
}
