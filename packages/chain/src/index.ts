// packages/chain/src/index.ts
// Shared chain glue: ABIs, id encoding, and viem client factories. Used by the
// orchestrator (writes) and the indexer (reads) so their bytes32 keys always agree.

export * from "./abi";
export * from "./ids";
export * from "./client";
export * from "./bus";
export * from "./indexer";
