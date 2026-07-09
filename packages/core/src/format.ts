// packages/core/src/format.ts
//
// Money is always rendered from wei with fixed precision so the ledger stays in
// tabular alignment. Two decimals is the OKB display precision across the app.

const OKB = 10n ** 18n;

export function toOkb(wei: bigint | string): number {
  const v = typeof wei === "string" ? BigInt(wei) : wei;
  return Number(v) / Number(OKB);
}

export function formatOkb(wei: bigint | string, decimals = 2): string {
  return toOkb(wei).toFixed(decimals);
}

export function shortHash(hash: string, lead = 6, tail = 2): string {
  if (hash.length <= lead + tail + 1) return hash;
  return `${hash.slice(0, lead)}…${hash.slice(-tail)}`; // ellipsis, not an em dash
}
