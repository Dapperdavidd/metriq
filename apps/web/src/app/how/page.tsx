// apps/web/src/app/how/page.tsx
//
// The explainer. Each of the four parts gets its own anchored section so the landing
// cards can deep-link into it. The Verso section renders the real Briefing table and
// the ranking metric straight from the frozen core, so the docs cannot drift from code.

import Link from "next/link";
import { SUBTASKS, formatOkb, QUALITY_TARGET } from "@metriq/core";
import styles from "./how.module.css";

export const metadata = {
  title: "How it works / Metriq",
};

export default function How() {
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>HOW IT WORKS</p>
        <h1 className={styles.title}>Four parts, one race</h1>
        <p className={styles.lede}>
          Metriq is a thin, verifiable core. The chain owns money, caps and scores. Everything the
          leaderboard shows is derived from on-chain events, so the standings are reproducible, not
          asserted. Here is what each named part does.
        </p>
      </header>

      <section id="metriq" className={styles.section}>
        <div className={styles.marker} style={{ background: "var(--ink)" }} aria-hidden />
        <div className={styles.body}>
          <h2 className={styles.h2}>
            Metriq <span className={styles.role}>the app</span>
          </h2>
          <p>
            The product wrapper: metered spending control for AI agents. A capped budget, a router
            that charges per subtask and declines in real time at the cap, a live ledger, and a
            verifiable receipt per action. Framed as a utility it is a finance copilot for agents;
            framed as a demo it is Verso, the arena.
          </p>
        </div>
      </section>

      <section id="tallo" className={styles.section}>
        <div className={styles.marker} style={{ background: "var(--lane-slate)" }} aria-hidden />
        <div className={styles.body}>
          <h2 className={styles.h2}>
            Tallo <span className={styles.role}>the ledger</span>
          </h2>
          <p>
            Per-agent budgets, hard-capped, charged in real time. Funding equals the cap: the value
            staked is the ceiling. The spine of the whole design is the decline law: on a cap breach
            the charge deactivates the account, emits the elimination, and returns false. It does not
            revert, because a reverted transaction persists no logs, and the elimination event is
            exactly what the leaderboard is built from.
          </p>
          <ul className={styles.events}>
            <li>
              <code>AccountOpened</code> the grid locks in, identical cap badges
            </li>
            <li>
              <code>Charged</code> a spend lands, the remaining balance ticks down
            </li>
            <li>
              <code>CapDeclined</code> the attempted overspend flashes on the task
            </li>
            <li>
              <code>CappedOut</code> the lane goes red, eliminated, on chain
            </li>
          </ul>
        </div>
      </section>

      <section id="verso" className={styles.section}>
        <div className={styles.marker} style={{ background: "var(--lane-purple)" }} aria-hidden />
        <div className={styles.body}>
          <h2 className={styles.h2}>
            Verso <span className={styles.role}>the arena</span>
          </h2>
          <p>
            Four agents, four identical 1.00 OKB budgets, one task, ranked live on value per dollar.
            Each agent produces a market briefing by buying six priced subtasks. Quality is a fixed
            rubric the host computes, no LLM judging, fully reproducible. Premium everything plus the
            optional VERIFY costs 1.15 OKB, impossible under a 1.00 cap, which is what eliminates the
            greedy strategy on cue.
          </p>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>SUBTASK</th>
                  <th className={styles.num}>BASE</th>
                  <th className={styles.num}>PREM</th>
                  <th>REQ</th>
                </tr>
              </thead>
              <tbody>
                {SUBTASKS.map((s) => (
                  <tr key={s.id}>
                    <td className={styles.num}>{s.id}</td>
                    <td>{s.name}</td>
                    <td className={styles.num}>{formatOkb(s.basePrice)}</td>
                    <td className={styles.num}>
                      {s.premiumPrice !== null ? formatOkb(s.premiumPrice) : "--"}
                    </td>
                    <td>{s.required ? "yes" : "no"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className={styles.h3}>The ranking, and the trap in it</h3>
          <p>
            The metric is value per OKB: quality points divided by OKB spent. The trap: an agent that
            barely spends can post the highest raw value per OKB while delivering the least quality.
            So the tower does not rank on value per OKB alone. It ranks in two keys: agents that
            reached the quality target (currently {QUALITY_TARGET}) come first, by value per OKB, then
            the rest, and eliminated lanes are pinned last with their metric frozen and struck
            through. The winner leads on delivered value, not on doing the least.
          </p>
        </div>
      </section>

      <section id="stub" className={styles.section}>
        <div className={styles.marker} style={{ background: "var(--lane-green)" }} aria-hidden />
        <div className={styles.body}>
          <h2 className={styles.h2}>
            Stub <span className={styles.role}>the receipt</span>
          </h2>
          <p>
            A Stub is not a new contract, it is a rendering rule over events that already exist. One
            completed subtask emits a Stub event with its paired Charged; a receipt folds that into a
            perforated ticket whose serial is the transaction hash and links out to the X Layer
            explorer. This upgrades trust the leaderboard to verify the leaderboard: every number on
            screen resolves to a transaction a judge can open.
          </p>
        </div>
      </section>

      <footer className={styles.footer}>
        <Link href="/arena" className={styles.cta}>
          See it live in the arena
          <span aria-hidden> -&gt;</span>
        </Link>
        <Link href="/build" className={styles.ctaGhost}>
          Build your own round
        </Link>
      </footer>
    </div>
  );
}
