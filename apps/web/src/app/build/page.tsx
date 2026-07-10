// apps/web/src/app/build/page.tsx
//
// The round builder. Compose your own field: which agents are staked, each one's spend
// knobs (reserve, greed, horizon), and the shared cap. This is the interactive surface
// the playback screen never had. Execution is wired in two steps: a local preview now,
// a real on-chain run (server-side, operator key in env) next.

"use client";

import { useState } from "react";
import Link from "next/link";
import { AGENTS } from "@metriq/core";
import { FIELD } from "@metriq/strategies";
import styles from "./build.module.css";

interface AgentConfig {
  name: string;
  displayName: string;
  color: string;
  inField: boolean;
  reserve: number;
  greed: number;
  horizon: number;
}

const PRESETS: readonly AgentConfig[] = FIELD.map((s) => {
  const meta = AGENTS[s.name];
  return {
    name: s.name,
    displayName: meta?.name ?? s.name.toUpperCase(),
    color: meta?.displayColor ?? "var(--lane-slate)",
    inField: true,
    reserve: s.knobs.reserve,
    greed: s.knobs.greed,
    horizon: s.knobs.horizon,
  };
});

export default function Build() {
  const [agents, setAgents] = useState<AgentConfig[]>(() => PRESETS.map((p) => ({ ...p })));
  const [capOkb, setCapOkb] = useState("1.00");

  const update = (name: string, patch: Partial<AgentConfig>) =>
    setAgents((prev) => prev.map((a) => (a.name === name ? { ...a, ...patch } : a)));

  const staked = agents.filter((a) => a.inField);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>ROUND BUILDER</p>
        <h1 className={styles.title}>Compose your field</h1>
        <p className={styles.lede}>
          Every agent is one base spend policy plus three knobs. Stake the agents you want, tune each
          one, set the shared cap, then run the round. The strategy runs off chain; the cap and every
          charge settle on chain.
        </p>
      </header>

      <section className={styles.controls} aria-label="Round settings">
        <label className={styles.capField}>
          <span className={styles.capLabel}>CAP PER AGENT</span>
          <span className={styles.capInputWrap}>
            <input
              className={`${styles.capInput} mono`}
              value={capOkb}
              inputMode="decimal"
              onChange={(e) => setCapOkb(e.target.value)}
              aria-label="Cap per agent in OKB"
            />
            <span className={styles.capUnit}>OKB</span>
          </span>
        </label>
        <p className={styles.staked}>
          <span className={styles.stakedNum}>{staked.length}</span> agents staked, identical budgets
          by construction.
        </p>
      </section>

      <section className={styles.agents} aria-label="Agents">
        {agents.map((a) => (
          <article
            key={a.name}
            className={`${styles.card} ${a.inField ? "" : styles.cardOff}`}
          >
            <span className={styles.cardBar} style={{ background: a.color }} aria-hidden />
            <div className={styles.cardHead}>
              <div className={styles.cardId}>
                <span className={styles.cardName}>{a.displayName}</span>
                <span className={styles.cardBase}>base policy: {a.name}</span>
              </div>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={a.inField}
                  onChange={(e) => update(a.name, { inField: e.target.checked })}
                />
                <span>{a.inField ? "STAKED" : "BENCHED"}</span>
              </label>
            </div>

            <div className={styles.knobs}>
              <Knob
                label="reserve"
                value={a.reserve}
                min={0}
                max={0.4}
                step={0.01}
                fmt={(v) => v.toFixed(2)}
                disabled={!a.inField}
                onChange={(v) => update(a.name, { reserve: v })}
              />
              <Knob
                label="greed"
                value={a.greed}
                min={0}
                max={1}
                step={0.05}
                fmt={(v) => v.toFixed(2)}
                disabled={!a.inField}
                onChange={(v) => update(a.name, { greed: v })}
              />
              <Knob
                label="horizon"
                value={a.horizon}
                min={0}
                max={6}
                step={1}
                fmt={(v) => String(v)}
                disabled={!a.inField}
                onChange={(v) => update(a.name, { horizon: v })}
              />
            </div>
          </article>
        ))}
      </section>

      <section className={styles.run} aria-label="Run">
        <div className={styles.runNote}>
          <span className={styles.runTag}>PREVIEW</span>
          <p>
            Watch the pinned exhibition round in the arena now. Running your exact configuration on
            chain is the next step being wired: the browser posts this field to the host, which holds
            the operator key and drives the real transactions.
          </p>
        </div>
        <div className={styles.runActions}>
          <Link href="/arena" className={styles.runPrimary}>
            Preview in the arena
            <span aria-hidden> -&gt;</span>
          </Link>
          <button
            type="button"
            className={styles.runOnChain}
            disabled
            title="On-chain run is being wired next"
          >
            Run on chain
            <span className={styles.soon}>SOON</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function Knob(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className={styles.knob}>
      <span className={styles.knobHead}>
        <span className={styles.knobLabel}>{props.label}</span>
        <span className={`${styles.knobValue} mono`}>{props.fmt(props.value)}</span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className={styles.range}
      />
    </label>
  );
}
