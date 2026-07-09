// packages/core/src/agents.ts
//
// The field registry. Four seeded strategies, four identical budgets, one task.
// Display name and F1 timing colour per agent. The colour is a CSS custom
// property so the design tokens stay the single source for the palette.

export interface AgentMeta {
  readonly id: string;
  readonly name: string; // uppercase display label on the tower
  readonly displayColor: string; // a Grid Ferme lane token
}

export const AGENTS: Readonly<Record<string, AgentMeta>> = {
  adaptive: { id: "adaptive", name: "ADAPTIVE", displayColor: "var(--lane-purple)" },
  balanced: { id: "balanced", name: "BALANCED", displayColor: "var(--lane-green)" },
  conservative: { id: "conservative", name: "CONSERVATIVE", displayColor: "var(--lane-slate)" },
  greedy: { id: "greedy", name: "GREEDY", displayColor: "var(--lane-red)" },
};

// The demo default field. Field size is a parameter, not a constant: cutting to a
// two-agent duel under deadline is slicing this array, not a refactor.
export const FIELD_ORDER: readonly string[] = ["adaptive", "balanced", "conservative", "greedy"];

export function agentMeta(agentId: string): AgentMeta {
  return (
    AGENTS[agentId] ?? {
      id: agentId,
      name: agentId.toUpperCase(),
      displayColor: "var(--lane-slate)",
    }
  );
}
