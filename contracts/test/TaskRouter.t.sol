// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Tallo} from "../src/Tallo.sol";
import {TaskRouter} from "../src/TaskRouter.sol";

/// @notice Proves the router's guards (controller auth, double-bill), the decline
///         mirror (PaymentDeclined without reverting, alongside Tallo's CappedOut),
///         on-chain scoring from the posted table, and the table-driven VERIFY bonus.
contract TaskRouterTest is Test {
    Tallo internal tallo;
    TaskRouter internal router;

    address internal operator = makeAddr("operator");
    address internal treasury = makeAddr("treasury");
    address internal controller = makeAddr("controller"); // the orchestrator key

    bytes32 internal constant ROUND = bytes32(uint256(0x3fa9));
    bytes32 internal constant AGENT = keccak256("greedy");

    // task ids as bytes32 (the string "0".."5" maps to these on chain)
    bytes32 internal constant FETCH = bytes32(uint256(0));
    bytes32 internal constant CLEAN = bytes32(uint256(1));
    bytes32 internal constant ENRICH = bytes32(uint256(2));
    bytes32 internal constant ANALYZE = bytes32(uint256(3));
    bytes32 internal constant VERIFY = bytes32(uint256(4));
    bytes32 internal constant PUBLISH = bytes32(uint256(5));

    event PaymentDeclined(bytes32 indexed roundId, bytes32 indexed agentId, bytes32 indexed taskId, TaskRouter.Tier tier);
    event CappedOut(bytes32 indexed roundId, bytes32 indexed agentId, uint128 totalSpent);
    event Stub(
        bytes32 indexed roundId,
        bytes32 indexed agentId,
        bytes32 indexed taskId,
        TaskRouter.Tier tier,
        uint128 price,
        uint32 score,
        uint64 cumulativeScore
    );

    function setUp() public {
        tallo = new Tallo(operator, treasury);
        router = new TaskRouter(tallo, operator);
        vm.prank(operator);
        tallo.initRouter(address(router));

        _listBriefing();

        // Open + stake, assign the controller.
        vm.deal(operator, 1 ether);
        vm.prank(operator);
        tallo.openAccount{value: 1 ether}(ROUND, AGENT);
        vm.prank(operator);
        router.assignController(ROUND, AGENT, controller);
    }

    function _list(
        bytes32 id,
        uint128 base,
        uint128 prem,
        uint32 baseScore,
        uint32 premScore,
        bytes32 bonusTask,
        uint32 bonusScore,
        bool required
    ) internal {
        TaskRouter.Task memory t = TaskRouter.Task({
            basePrice: base,
            premiumPrice: prem,
            baseScore: baseScore,
            premiumScore: premScore,
            bonusTaskId: bonusTask,
            bonusScore: bonusScore,
            required: required,
            exists: false
        });
        vm.prank(operator);
        router.listTask(ROUND, id, t);
    }

    // "The Briefing": the exact posted table.
    function _listBriefing() internal {
        _list(FETCH, 0.10 ether, 0, 10, 10, bytes32(0), 0, true);
        _list(CLEAN, 0.12 ether, 0, 10, 10, bytes32(0), 0, true);
        _list(ENRICH, 0.10 ether, 0.28 ether, 10, 25, bytes32(0), 0, true);
        _list(ANALYZE, 0.12 ether, 0.30 ether, 12, 28, bytes32(0), 0, true);
        _list(VERIFY, 0.15 ether, 0, 8, 8, bytes32(0), 0, false);
        _list(PUBLISH, 0.20 ether, 0, 15, 15, VERIFY, 5, true); // +5 if VERIFY done
    }

    function _pay(bytes32 taskId, TaskRouter.Tier tier) internal returns (bool) {
        vm.prank(controller);
        return router.pay(ROUND, AGENT, taskId, tier);
    }

    function test_pay_onlyController() public {
        vm.expectRevert(bytes("not controller"));
        router.pay(ROUND, AGENT, FETCH, TaskRouter.Tier.BASE); // msg.sender is the test, not controller
    }

    function test_pay_unknownTask_reverts() public {
        vm.prank(controller);
        vm.expectRevert(bytes("unknown/done"));
        router.pay(ROUND, AGENT, bytes32(uint256(99)), TaskRouter.Tier.BASE);
    }

    function test_pay_doubleBill_reverts() public {
        assertTrue(_pay(FETCH, TaskRouter.Tier.BASE), "first pay ok");
        vm.prank(controller);
        vm.expectRevert(bytes("unknown/done"));
        router.pay(ROUND, AGENT, FETCH, TaskRouter.Tier.BASE);
    }

    function test_pay_tierUnavailable_reverts() public {
        // FETCH has no premium tier.
        vm.prank(controller);
        vm.expectRevert(bytes("tier unavailable"));
        router.pay(ROUND, AGENT, FETCH, TaskRouter.Tier.PREMIUM);
    }

    function test_pay_scoresOnChain_andEmitsStub() public {
        vm.expectEmit(true, true, true, true);
        emit Stub(ROUND, AGENT, ENRICH, TaskRouter.Tier.PREMIUM, 0.28 ether, 25, 25);
        _pay(ENRICH, TaskRouter.Tier.PREMIUM);
        assertEq(router.scoreOf(ROUND, AGENT), 25, "premium ENRICH scores 25");
    }

    function test_pay_verifyBonus_appliesToPublish() public {
        _pay(FETCH, TaskRouter.Tier.BASE); // 10
        _pay(VERIFY, TaskRouter.Tier.BASE); // +8 = 18, and unlocks the bonus
        // PUBLISH should now score 15 + 5 = 20.
        vm.expectEmit(true, true, true, true);
        emit Stub(ROUND, AGENT, PUBLISH, TaskRouter.Tier.BASE, 0.20 ether, 20, 38);
        _pay(PUBLISH, TaskRouter.Tier.BASE);
        assertEq(router.scoreOf(ROUND, AGENT), 38, "10 + 8 + (15+5) = 38");
    }

    function test_pay_noVerify_noBonus() public {
        _pay(FETCH, TaskRouter.Tier.BASE); // 10
        _pay(PUBLISH, TaskRouter.Tier.BASE); // 15, no bonus without VERIFY
        assertEq(router.scoreOf(ROUND, AGENT), 25, "no VERIFY means no +5");
    }

    /// The greedy route: premium everywhere plus VERIFY caps out at PUBLISH. The
    /// decline must emit PaymentDeclined (router) AND CappedOut (tallo) in one tx,
    /// without reverting, and the score must freeze at its pre-PUBLISH total.
    function test_greedyRoute_capsAtPublish_declineMirrors() public {
        _pay(FETCH, TaskRouter.Tier.BASE); // 0.10  score 10
        _pay(CLEAN, TaskRouter.Tier.BASE); // 0.12  score 20
        _pay(ENRICH, TaskRouter.Tier.PREMIUM); // 0.28  score 45
        _pay(ANALYZE, TaskRouter.Tier.PREMIUM); // 0.30  score 73
        _pay(VERIFY, TaskRouter.Tier.BASE); // 0.15  score 81
        // spent 0.95, remaining 0.05, PUBLISH needs 0.20: decline.

        vm.expectEmit(true, true, false, true);
        emit CappedOut(ROUND, AGENT, 0.95 ether);
        vm.expectEmit(true, true, true, true);
        emit PaymentDeclined(ROUND, AGENT, PUBLISH, TaskRouter.Tier.BASE);

        vm.prank(controller);
        bool ok = router.pay(ROUND, AGENT, PUBLISH, TaskRouter.Tier.BASE);

        assertFalse(ok, "PUBLISH declines at the cap");
        assertEq(router.scoreOf(ROUND, AGENT), 81, "score frozen at 81, PUBLISH never scored");
        assertFalse(router.completed(ROUND, AGENT, PUBLISH), "declined task is not marked completed");
        (, uint128 spent, bool active,) = tallo.accountOf(ROUND, AGENT);
        assertEq(spent, 0.95 ether, "spend frozen at 0.95");
        assertFalse(active, "eliminated");
    }
}
