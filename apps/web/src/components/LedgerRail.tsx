// apps/web/src/components/LedgerRail.tsx
//
// The statement half. The Copilot readout sits at the top; below it, the receipt feed:
// every completed subtask is a line, newest first. In Ring 2 (Phase 4) each of these
// becomes a perforated Stub whose serial links to the tx on the X Layer explorer.

"use client";

import { type RunState, agentMeta } from "@metriq/core";
import { Copilot } from "./Copilot";
import styles from "./LedgerRail.module.css";

export function LedgerRail({ state, roundId }: { state: RunState; roundId: string }) {
  const feed = [...state.stubs].reverse();

  return (
    <div className={styles.rail}>
      <Copilot line={state.copilotLine} />

      <div className={styles.ledgerHead}>
        <span className={styles.ledgerTitle}>LEDGER</span>
        <span className={`${styles.ledgerRound} mono`}>{roundId.toUpperCase()}</span>
      </div>

      <div className={styles.feed}>
        {feed.length === 0 ? (
          <p className={styles.empty}>No receipts yet. Every purchase writes a line here.</p>
        ) : (
          feed.map((stub, i) => {
            const meta = agentMeta(stub.agent);
            return (
              <div className={styles.receipt} key={`${stub.agent}-${stub.taskId}-${i}`}>
                <span className={styles.dot} style={{ background: meta.displayColor }} aria-hidden />
                <span className={styles.rAgent}>{meta.name}</span>
                <span className={styles.rLabel}>{stub.label}</span>
                <span className={`${styles.rCost} mono`}>-{stub.costOkb}</span>
                <span className={`${styles.rQual} mono`}>+{stub.quality}</span>
                <span className={`${styles.rRemain} mono`}>{stub.remainingOkb}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
