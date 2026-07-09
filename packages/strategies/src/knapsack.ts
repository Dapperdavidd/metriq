// packages/strategies/src/knapsack.ts
//
// The optimiser: a bounded 0/1 knapsack over remaining budget, both tiers of a task
// entered as separate items. The item pool is bounded to horizon + 3 so it recomputes
// cheaply on every tick. This is the interview-impressive artifact: a real optimizer,
// not a lookup.

import type { Task } from "./types";

export interface Item {
  task: Task;
  premium: boolean;
}

export function itemPrice(it: Item): bigint {
  return it.premium && it.task.premiumPrice !== null ? it.task.premiumPrice : it.task.basePrice;
}

export function itemScore(it: Item): number {
  return it.premium && it.task.premiumPrice !== null ? it.task.premiumScore : it.task.baseScore;
}

function vpd(it: Item): number {
  const okb = Number(itemPrice(it)) / 1e18;
  return okb > 0 ? itemScore(it) / okb : 0;
}

export function knapsack(tasks: readonly Task[], budget: bigint, horizon: number): Item[] {
  const items: Item[] = tasks.flatMap((t) =>
    t.premiumPrice !== null
      ? [
          { task: t, premium: false },
          { task: t, premium: true },
        ]
      : [{ task: t, premium: false }],
  );

  items.sort((a, b) => vpd(b) - vpd(a));
  const pool = items.slice(0, horizon + 3); // bounded so it recomputes cheaply each tick

  let best: Item[] = [];
  let bestScore = 0;

  const used = new Set<string>();
  const walk = (i: number, spent: bigint, acc: Item[], score: number): void => {
    if (score > bestScore) {
      bestScore = score;
      best = [...acc];
    }
    if (i === pool.length) return;

    const it = pool[i]!;
    const price = itemPrice(it);
    // take branch: only if this task is not already in the accumulator (0/1 per task)
    if (!used.has(it.task.id) && spent + price <= budget) {
      used.add(it.task.id);
      walk(i + 1, spent + price, [...acc, it], score + itemScore(it));
      used.delete(it.task.id);
    }
    // skip branch
    walk(i + 1, spent, acc, score);
  };

  walk(0, 0n, [], 0);
  return best;
}
