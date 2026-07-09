// packages/chain/src/client.ts
//
// viem client factories. The operator key is read by the caller from env and passed
// in; it is never hardcoded and never logged. The chain is defined from config so the
// same code runs against a local anvil node (chainId 31337) or X Layer testnet.

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export interface ChainConfig {
  rpcUrl: string;
  chainId: number;
  talloAddress: Hex;
  taskRouterAddress: Hex;
}

export function metriqChain(chainId: number, rpcUrl: string) {
  return defineChain({
    id: chainId,
    name: chainId === 31337 ? "anvil" : "x-layer",
    nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}

export function makePublicClient(cfg: ChainConfig): PublicClient {
  return createPublicClient({
    chain: metriqChain(cfg.chainId, cfg.rpcUrl),
    transport: http(cfg.rpcUrl),
  });
}

export function makeWalletClient(cfg: ChainConfig, operatorKey: Hex): WalletClient {
  return createWalletClient({
    account: privateKeyToAccount(operatorKey),
    chain: metriqChain(cfg.chainId, cfg.rpcUrl),
    transport: http(cfg.rpcUrl),
  });
}
