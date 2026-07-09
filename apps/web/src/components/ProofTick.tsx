// apps/web/src/components/ProofTick.tsx
//
// Ring 3, the cut line. When the winner posts its Noir proof at settle, this green tick
// lands on the lane: it reached the quality target under the cap via a route matching a
// pre-run commitment, verified in zero knowledge. The win is proven, the route hidden.
// Cutting Ring 3 removes exactly this component and nothing else.

"use client";

import styles from "./ProofTick.module.css";

export function ProofTick() {
  return (
    <span
      className={styles.tick}
      title="Reached the quality target under cap, verified in zero knowledge. The route stays hidden."
    >
      <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden focusable="false">
        <path
          d="M3 8.5l3 3 7-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      PROVEN
    </span>
  );
}
