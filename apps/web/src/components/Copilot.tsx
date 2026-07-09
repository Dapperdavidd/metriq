// apps/web/src/components/Copilot.tsx
//
// The practicality score in one sentence. A narrator, never a judge. It reads the same
// reducer state the tower renders, so its number can never disagree with the tower's.
// On the mock (and whenever the live call is unavailable) this is the deterministic
// fallback line folded from state. It never goes blank mid-run.

"use client";

import styles from "./Copilot.module.css";

export function Copilot({ line }: { line: string }) {
  return (
    <div className={styles.copilot} aria-live="polite">
      <span className={styles.label}>COPILOT</span>
      <p className={styles.line}>{line ? `"${line}"` : " "}</p>
    </div>
  );
}
