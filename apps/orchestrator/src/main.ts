// apps/orchestrator/src/main.ts
//
// Entrypoint. Reads config from env and drives one Verso round. Run:
//   pnpm --filter @metriq/orchestrator start

import { loadConfig } from "./config";
import { runVerso } from "./run";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const stamp = () => new Date().toISOString().slice(11, 19);
  await runVerso(cfg, (msg) => console.log(`[${stamp()}] ${msg}`));
}

main().catch((err) => {
  console.error("orchestrator failed:", err);
  process.exitCode = 1;
});
