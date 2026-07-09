// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Tallo} from "../src/Tallo.sol";
import {TaskRouter} from "../src/TaskRouter.sol";

/// @notice Deploys Tallo + TaskRouter to X Layer testnet, wires the router, and seeds
///         "The Briefing" task table for a round. Run by the operator with their key:
///
///   forge script script/Deploy.s.sol \
///     --rpc-url $RPC_URL --broadcast --private-key $OPERATOR_KEY
///
/// Env: OPERATOR_KEY (throwaway testnet key), TREASURY_ADDRESS, optional ROUND_ID.
/// The operator address is derived from OPERATOR_KEY. This script never hardcodes a key.
contract Deploy is Script {
    // task ids as bytes32 (the string "0".."5" the app uses maps to these on chain)
    bytes32 internal constant FETCH = bytes32(uint256(0));
    bytes32 internal constant CLEAN = bytes32(uint256(1));
    bytes32 internal constant ENRICH = bytes32(uint256(2));
    bytes32 internal constant ANALYZE = bytes32(uint256(3));
    bytes32 internal constant VERIFY = bytes32(uint256(4));
    bytes32 internal constant PUBLISH = bytes32(uint256(5));

    function run() external {
        uint256 key = vm.envUint("OPERATOR_KEY");
        address operator = vm.addr(key);
        address treasury = vm.envOr("TREASURY_ADDRESS", operator);
        bytes32 roundId = bytes32(vm.envOr("ROUND_ID", uint256(0x3fa9)));

        vm.startBroadcast(key);

        Tallo tallo = new Tallo(operator, treasury);
        TaskRouter router = new TaskRouter(tallo, operator);
        tallo.initRouter(address(router));

        _seedBriefing(router, roundId);

        vm.stopBroadcast();

        console2.log("Tallo      :", address(tallo));
        console2.log("TaskRouter :", address(router));
        console2.log("operator   :", operator);
        console2.log("treasury   :", treasury);
        console2.log("roundId    :", vm.toString(roundId));
    }

    /// The exact posted table (prices in test OKB). Mirrors packages/core/src/tasks.ts.
    function _seedBriefing(TaskRouter router, bytes32 roundId) internal {
        _list(router, roundId, FETCH, 0.10 ether, 0, 10, 10, bytes32(0), 0, true);
        _list(router, roundId, CLEAN, 0.12 ether, 0, 10, 10, bytes32(0), 0, true);
        _list(router, roundId, ENRICH, 0.10 ether, 0.28 ether, 10, 25, bytes32(0), 0, true);
        _list(router, roundId, ANALYZE, 0.12 ether, 0.30 ether, 12, 28, bytes32(0), 0, true);
        _list(router, roundId, VERIFY, 0.15 ether, 0, 8, 8, bytes32(0), 0, false);
        _list(router, roundId, PUBLISH, 0.20 ether, 0, 15, 15, VERIFY, 5, true); // +5 if VERIFY done
    }

    function _list(
        TaskRouter router,
        bytes32 roundId,
        bytes32 id,
        uint128 base,
        uint128 prem,
        uint32 baseScore,
        uint32 premScore,
        bytes32 bonusTask,
        uint32 bonusScore,
        bool required
    ) internal {
        router.listTask(
            roundId,
            id,
            TaskRouter.Task({
                basePrice: base,
                premiumPrice: prem,
                baseScore: baseScore,
                premiumScore: premScore,
                bonusTaskId: bonusTask,
                bonusScore: bonusScore,
                required: required,
                exists: false
            })
        );
    }
}
