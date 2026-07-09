// apps/web/src/components/LaneRow.tsx
//
// One lane. The accent bar carries the F1 state, the budget meter drains as the agent
// spends, the value-per-OKB is the number the whole tower sorts on. When a cap-out
// arrives the row turns red and reads ELIMINATED with its reason, and the metric
// freezes struck through. That takeover is the single loudest moment on the screen.

"use client";

import { motion, useReducedMotion } from "framer-motion";
import { type Lane, subtaskName, formatOkb } from "@metriq/core";
import { laneAccent } from "../lib/accent";
import styles from "./LaneRow.module.css";

function statusLine(lane: Lane): string {
  if (lane.status === "eliminated") return lane.reason ?? "ELIMINATED";
  if (lane.status === "finished") return `FINISHED · ${lane.score} pts`;
  if (lane.lastTask) return `${subtaskName(lane.lastTask)} cleared`;
  return "staged";
}

export function LaneRow({ lane, fieldMax }: { lane: Lane; fieldMax: number }) {
  const reduced = useReducedMotion();
  const accent = laneAccent(lane);
  const eliminated = lane.status === "eliminated";

  const capNum = Number(lane.cap);
  const remainingFrac = capNum > 0 ? Math.max(0, Number(lane.remaining) / capNum) : 0;
  const valFrac = fieldMax > 0 ? Math.max(0, Math.min(1, lane.valuePerOkb / fieldMax)) : 0;

  return (
    <motion.div
      layout={!reduced}
      transition={{ layout: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] } }}
      className={`${styles.row} ${eliminated ? styles.eliminated : ""}`}
      style={{ ["--accent" as string]: accent }}
      role="row"
      aria-label={`Position ${lane.rank}, ${lane.name}, ${lane.valuePerOkb.toFixed(1)} value per OKB${
        eliminated ? ", eliminated" : ""
      }`}
    >
      <span className={styles.accentBar} aria-hidden />

      <span className={`${styles.pos} mono`} role="cell">
        {lane.rank}
      </span>

      <span className={styles.name} role="cell">
        <span className={styles.agent}>{lane.name}</span>
        <span className={`${styles.sub} ${eliminated ? styles.subOut : ""}`}>{statusLine(lane)}</span>
      </span>

      <span className={styles.meter} role="cell">
        <span className={styles.meterTrack}>
          <span
            className={styles.meterFill}
            style={{ width: `${remainingFrac * 100}%` }}
            data-drain
          />
        </span>
        <span className={`${styles.meterText} mono`}>{formatOkb(lane.remaining)} left</span>
      </span>

      <span className={styles.val} role="cell">
        <span className={`${styles.valNum} mono ${eliminated ? styles.valOut : ""}`}>
          {lane.valuePerOkb.toFixed(1)}
        </span>
        <span className={styles.valBarTrack} aria-hidden>
          <span className={styles.valBarFill} style={{ width: `${valFrac * 100}%` }} />
        </span>
      </span>
    </motion.div>
  );
}
