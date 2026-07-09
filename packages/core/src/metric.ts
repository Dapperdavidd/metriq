// packages/core/src/metric.ts
//
// One formula, one place. Value per OKB is the ranking metric. It is never stored
// on chain: it is derived from quality points (from the posted rubric) and spend
// (from Charged events).

export function valuePerOkb(qualityPoints: number, spentWei: bigint): number {
  if (spentWei === 0n) return 0;
  return qualityPoints / (Number(spentWei) / 1e18);
}

// The trap in the metric: an agent that barely spends can post the highest raw
// value per OKB while producing the lowest total quality. Conservative does exactly
// this. So the tower gates on a quality target first, then ranks on efficiency
// among the agents that actually delivered.
//
// Default target 80: Adaptive (88) and Balanced (85) clear it, Conservative (57)
// does not, Greedy is eliminated. Confirm on tuning day (open question with the
// operator). It is a single constant so tuning is a one-line change.
export const QUALITY_TARGET = 80;
