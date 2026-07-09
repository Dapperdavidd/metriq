// apps/orchestrator/src/util.ts
//
// A write mutex and a seeded jitter. The orchestrator serialises contract writes
// through the single operator key (one nonce sequence) and parallelises the waiting.
// The jitter is seeded so the pacing is reproducible take after take.

export class Mutex {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn, fn);
    // swallow rejection on the chain so one failed write does not poison the queue
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

// mulberry32: a tiny deterministic PRNG so the jitter seed reproduces the pacing.
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
