// apps/web/src/app/page.tsx
//
// The front door. A product explainer, not a screen dump: what Metriq is, the four
// named parts made distinguishable, the one law, and a clear way in. Grid Ferme on
// graph paper: timing colour used only to tag the four concepts, everything else ink.

import Link from "next/link";
import styles from "./landing.module.css";

interface Concept {
  id: string;
  name: string;
  role: string;
  blurb: string;
  accent: string;
}

const CONCEPTS: readonly Concept[] = [
  {
    id: "metriq",
    name: "Metriq",
    role: "the app",
    blurb: "Metered spending control for AI agents. See, cap, and receipt every dollar an autonomous agent spends.",
    accent: "var(--ink)",
  },
  {
    id: "tallo",
    name: "Tallo",
    role: "the ledger",
    blurb: "Per-agent budgets, hard-capped, charged in real time. On a cap breach it declines and emits, it never reverts.",
    accent: "var(--lane-slate)",
  },
  {
    id: "verso",
    name: "Verso",
    role: "the arena",
    blurb: "Four agents, four identical budgets, one task, ranked live on value per dollar. One gets capped out on cue.",
    accent: "var(--lane-purple)",
  },
  {
    id: "stub",
    name: "Stub",
    role: "the receipt",
    blurb: "A verifiable receipt per completed action. Every number on the leaderboard resolves to a transaction you can open.",
    accent: "var(--lane-green)",
  },
];

const BEATS: readonly string[] = ["OPEN", "STAKE", "COMPETE", "CAP OUT", "SETTLE"];

export default function Landing() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>METERED SPENDING FOR AI AGENTS</p>
        <h1 className={styles.headline}>
          Give an autonomous agent a budget it <em>cannot</em> break.
        </h1>
        <p className={styles.sub}>
          Metriq caps what an AI agent can spend and settles every charge on chain. Verso is the
          arena that control powers: agents race on value per dollar, one is capped out live by real
          contract mechanics, and the winner can prove it hit the target under cap without revealing
          how.
        </p>
        <div className={styles.ctaRow}>
          <Link href="/arena" className={styles.ctaPrimary}>
            Enter the arena
            <span aria-hidden> -&gt;</span>
          </Link>
          <Link href="/build" className={styles.ctaSecondary}>
            Build a round
          </Link>
        </div>
      </section>

      <section className={styles.law} aria-label="The one law">
        <span className={styles.lawTag}>THE ONE LAW</span>
        <p className={styles.lawText}>
          Decline, never revert. A reverted transaction persists no logs, so the cap-out cannot live
          inside a transaction that reverts. The charge returns false and emits the elimination; the
          event is the drama, and it stays on chain where the leaderboard is derived from it.
        </p>
      </section>

      <section className={styles.concepts} aria-label="The four parts">
        <h2 className={styles.sectionLabel}>THE FOUR PARTS</h2>
        <div className={styles.grid}>
          {CONCEPTS.map((c) => (
            <Link key={c.id} href={`/how#${c.id}`} className={styles.card}>
              <span className={styles.cardBar} style={{ background: c.accent }} aria-hidden />
              <div className={styles.cardHead}>
                <span className={styles.cardName}>{c.name}</span>
                <span className={styles.cardRole}>{c.role}</span>
              </div>
              <p className={styles.cardBlurb}>{c.blurb}</p>
              <span className={styles.cardMore}>How it works -&gt;</span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.lifecycle} aria-label="Run lifecycle">
        <h2 className={styles.sectionLabel}>ONE ROUND, FIVE BEATS</h2>
        <div className={styles.beats}>
          {BEATS.map((b, i) => (
            <div key={b} className={styles.beat}>
              <span className={styles.beatDot} aria-hidden />
              <span className={styles.beatName}>{b}</span>
              {i < BEATS.length - 1 && <span className={styles.beatLine} aria-hidden />}
            </div>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <p className={styles.footerLine}>
          Built on X Layer, OKX zkEVM L2. Solidity, TypeScript, Noir.
        </p>
        <Link href="/arena" className={styles.ctaPrimary}>
          Watch a round
          <span aria-hidden> -&gt;</span>
        </Link>
      </footer>
    </div>
  );
}
