# Metriq contracts

Solidity 0.8.24, Foundry. Two contracts plus one Ring 3 interface.

- **Tallo.sol** owns money and the cap. `charge()` DECLINES on a cap breach (returns
  false, emits `CappedOut`), it never reverts. That is the spine of the design.
- **TaskRouter.sol** owns the task table and the score ledger. `pay()` is the one paid
  entrypoint; on a decline it emits `PaymentDeclined` and returns false, no revert.
  Scoring is on chain from the posted table (with a table-driven VERIFY bonus).
- **RevealVerifier.sol** is the Ring 3 interface (cut line).

## Test (no network)

```bash
forge test -vv
```

17 tests, including a 512-run fuzz on the cap boundary. The key test,
`test_charge_capBreach_declines_withoutReverting`, proves the elimination log
survives on chain.

## Deploy (operator runs this, with a throwaway testnet key)

This step touches funds and a live network, so it is yours to run, not the build's.

```bash
# in contracts/, with .env populated (OPERATOR_KEY, RPC_URL, TREASURY_ADDRESS)
forge script script/Deploy.s.sol \
  --rpc-url "$RPC_URL" --broadcast --private-key "$OPERATOR_KEY"
```

It deploys Tallo + TaskRouter, wires the router (set-once), and seeds "The Briefing"
task table for `ROUND_ID` (default `0x3fa9`). Copy the printed `Tallo` and `TaskRouter`
addresses into the root `.env` as `TALLO_ADDRESS` and `TASK_ROUTER_ADDRESS`.

## Design notes

- **Set-once router.** `Tallo` and `TaskRouter` reference each other, so both cannot be
  `immutable`. `Tallo.router` is set once via `initRouter()` behind a zero-address guard:
  the same freeze guarantee without a CREATE2 dance.
- **fund == cap.** `openAccount{value: cap}` funds the account; each `charge` settles
  `amount` to the treasury. Swap the `call{value}` site for `token.transfer` and add a
  ReentrancyGuard for a USDC mainnet framing. Fine as-is for the testnet demo.
- **Task ids.** The app uses the strings `"0".."5"`; on chain they are
  `bytes32(uint256(n))`. Keep that mapping when wiring the orchestrator.

## Dependencies

`forge-std` is vendored under `lib/` (this environment has no network for
`forge install` / `soldeer`, and the repo intentionally uses no git submodules).
