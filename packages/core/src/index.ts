// packages/core/src/index.ts
// The frozen core. RunEvent shape, the shared reducer, the metric, the Stub fold,
// and the domain tables. Everything downstream imports from here.

export * from "./events";
export * from "./agents";
export * from "./tasks";
export * from "./metric";
export * from "./format";
export * from "./stub";
export * from "./reducer";
export * from "./snapshot";
