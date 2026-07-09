// apps/web/src/components/StubReceipt.tsx
//
// A Stub is the verifiable receipt: one completed subtask, folded into a torn-edge
// ticket whose serial is the tx hash. The perforation is the product's signature
// carried into the receipt. The serial links out to the X Layer explorer, so every
// number on screen resolves to a tx a judge can open. (Ring 2.)

"use client";

import { type Stub, agentMeta, shortHash } from "@metriq/core";
import styles from "./StubReceipt.module.css";

const EXPLORER_BASE = process.env.NEXT_PUBLIC_EXPLORER_BASE ?? "https://www.oklink.com/xlayer-test";

function explorerUrl(serial: string): string | null {
  if (!serial || serial === "0x0" || serial.length < 10) return null;
  return `${EXPLORER_BASE}/tx/${serial}`;
}

export function StubReceipt({ stub, index }: { stub: Stub; index: number }) {
  const meta = agentMeta(stub.agent);
  const url = explorerUrl(stub.serial);
  const serialText = shortHash(stub.serial);

  return (
    <article className={styles.receipt}>
      <div className={styles.top}>
        <span className={styles.no}>STUB #{String(index).padStart(2, "0")}</span>
        {url ? (
          <a className={styles.serial} href={url} target="_blank" rel="noreferrer">
            {serialText}
          </a>
        ) : (
          <span className={styles.serial}>{serialText}</span>
        )}
      </div>

      <div className={styles.who}>
        <span className={styles.dot} style={{ background: meta.displayColor }} aria-hidden />
        <span className={styles.agent}>{meta.name}</span>
        <span className={styles.label}>{stub.label}</span>
      </div>

      <dl className={styles.figs}>
        <div className={styles.fig}>
          <dt>cost</dt>
          <dd className={styles.cost}>-{stub.costOkb}</dd>
        </div>
        <div className={styles.fig}>
          <dt>quality</dt>
          <dd className={styles.qual}>+{stub.quality}</dd>
        </div>
        <div className={styles.fig}>
          <dt>remaining</dt>
          <dd>{stub.remainingOkb}</dd>
        </div>
      </dl>

      <div className={styles.perf} aria-hidden />
    </article>
  );
}
