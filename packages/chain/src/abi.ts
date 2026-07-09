// packages/chain/src/abi.ts
//
// Focused viem ABIs for the two contracts, hand-written as const so viem infers
// argument and event types end to end. Only the surface the orchestrator and indexer
// use is included. Kept in sync with contracts/src by hand; the shape is small.

export const talloAbi = [
  {
    type: "function",
    name: "initRouter",
    stateMutability: "nonpayable",
    inputs: [{ name: "_router", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "openAccount",
    stateMutability: "payable",
    inputs: [
      { name: "roundId", type: "bytes32" },
      { name: "agentId", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roundId", type: "bytes32" },
      { name: "agentId", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "accountOf",
    stateMutability: "view",
    inputs: [
      { name: "roundId", type: "bytes32" },
      { name: "agentId", type: "bytes32" },
    ],
    outputs: [
      { name: "cap", type: "uint128" },
      { name: "spent", type: "uint128" },
      { name: "active", type: "bool" },
      { name: "exists", type: "bool" },
    ],
  },
  {
    type: "event",
    name: "AccountOpened",
    inputs: [
      { name: "roundId", type: "bytes32", indexed: true },
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "cap", type: "uint128", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Charged",
    inputs: [
      { name: "roundId", type: "bytes32", indexed: true },
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "amount", type: "uint128", indexed: false },
      { name: "spent", type: "uint128", indexed: false },
      { name: "remaining", type: "uint128", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CapDeclined",
    inputs: [
      { name: "roundId", type: "bytes32", indexed: true },
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "attempted", type: "uint128", indexed: false },
      { name: "remaining", type: "uint128", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CappedOut",
    inputs: [
      { name: "roundId", type: "bytes32", indexed: true },
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "totalSpent", type: "uint128", indexed: false },
    ],
  },
] as const;

const taskTuple = {
  name: "task",
  type: "tuple",
  components: [
    { name: "basePrice", type: "uint128" },
    { name: "premiumPrice", type: "uint128" },
    { name: "baseScore", type: "uint32" },
    { name: "premiumScore", type: "uint32" },
    { name: "bonusTaskId", type: "bytes32" },
    { name: "bonusScore", type: "uint32" },
    { name: "required", type: "bool" },
    { name: "exists", type: "bool" },
  ],
} as const;

export const taskRouterAbi = [
  {
    type: "function",
    name: "listTask",
    stateMutability: "nonpayable",
    inputs: [{ name: "roundId", type: "bytes32" }, { name: "taskId", type: "bytes32" }, taskTuple],
    outputs: [],
  },
  {
    type: "function",
    name: "assignController",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roundId", type: "bytes32" },
      { name: "agentId", type: "bytes32" },
      { name: "spender", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "pay",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roundId", type: "bytes32" },
      { name: "agentId", type: "bytes32" },
      { name: "taskId", type: "bytes32" },
      { name: "tier", type: "uint8" },
    ],
    outputs: [{ name: "ok", type: "bool" }],
  },
  {
    type: "function",
    name: "finish",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roundId", type: "bytes32" },
      { name: "agentId", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "scoreOf",
    stateMutability: "view",
    inputs: [
      { name: "roundId", type: "bytes32" },
      { name: "agentId", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "event",
    name: "Stub",
    inputs: [
      { name: "roundId", type: "bytes32", indexed: true },
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "taskId", type: "bytes32", indexed: true },
      { name: "tier", type: "uint8", indexed: false },
      { name: "price", type: "uint128", indexed: false },
      { name: "score", type: "uint32", indexed: false },
      { name: "cumulativeScore", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PaymentDeclined",
    inputs: [
      { name: "roundId", type: "bytes32", indexed: true },
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "taskId", type: "bytes32", indexed: true },
      { name: "tier", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RunFinished",
    inputs: [
      { name: "roundId", type: "bytes32", indexed: true },
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "totalScore", type: "uint64", indexed: false },
    ],
  },
] as const;
