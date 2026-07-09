// apps/web/src/components/LedgerRail.tsx
//
// The statement half. The Copilot readout sits at the top; below it, the Stub feed:
// every completed subtask is a torn-edge receipt whose serial resolves to a tx on the
// X Layer explorer. This is what upgrades "trust the leaderboard" to "verify the
// leaderboard".

"use client";

import type { RunState } from "@metriq/core";
import { Copilot } from "./Copilot";
import { StubReceipt } from "./StubReceipt";
import styles from "./LedgerRail.module.css";

export function LedgerRail({
  state,
  roundId,
  copilotLine,
}: {
  state: RunState;
  roundId: string;
  copilotLine: string;
}) {
  // Number receipts in creation order, then show newest first.
  const numbered = state.stubs.map((stub, i) => ({ stub, index: i + 1 }));
  const feed = [...numbered].reverse();

  return (
    <div className={styles.rail}>
      <Copilot line={copilotLine} />

      <div className={styles.ledgerHead}>
        <span className={styles.ledgerTitle}>LEDGER</span>
        <span className={`${styles.ledgerRound} mono`}>
          {feed.length} {feed.length === 1 ? "receipt" : "receipts"} · {roundId.toUpperCase()}
        </span>
      </div>

      <div className={styles.feed}>
        {feed.length === 0 ? (
          <p className={styles.empty}>No receipts yet. Every purchase tears off a Stub here.</p>
        ) : (
          feed.map(({ stub, index }) => (
            <StubReceipt key={`${stub.agent}-${stub.taskId}-${index}`} stub={stub} index={index} />
          ))
        )}
      </div>
    </div>
  );
}
