// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Tallo} from "../src/Tallo.sol";

/// @notice The decline path is the spine of the design. These tests prove the cap
///         breach DECLINES (returns false, emits CappedOut) without reverting, so the
///         elimination log survives on chain.
contract TalloTest is Test {
    Tallo internal tallo;

    address internal operator = makeAddr("operator");
    address internal treasury = makeAddr("treasury");
    address internal router = makeAddr("router");

    bytes32 internal constant ROUND = bytes32(uint256(0x3fa9));
    bytes32 internal constant AGENT = keccak256("greedy");

    // Mirror the contract's events for expectEmit.
    event CapDeclined(bytes32 indexed roundId, bytes32 indexed agentId, uint128 attempted, uint128 remaining);
    event CappedOut(bytes32 indexed roundId, bytes32 indexed agentId, uint128 totalSpent);
    event Charged(
        bytes32 indexed roundId, bytes32 indexed agentId, uint128 amount, uint128 spent, uint128 remaining
    );

    function setUp() public {
        tallo = new Tallo(operator, treasury);
        vm.prank(operator);
        tallo.initRouter(router);
    }

    function _open(uint128 cap) internal {
        vm.deal(operator, cap);
        vm.prank(operator);
        tallo.openAccount{value: cap}(ROUND, AGENT);
    }

    function test_initRouter_isSetOnce() public {
        vm.prank(operator);
        vm.expectRevert(bytes("router set"));
        tallo.initRouter(makeAddr("other"));
    }

    function test_openAccount_setsCapAndEmits() public {
        _open(1 ether);
        (uint128 cap, uint128 spent, bool active, bool exists) = tallo.accountOf(ROUND, AGENT);
        assertEq(cap, 1 ether, "cap");
        assertEq(spent, 0, "spent");
        assertTrue(active, "active");
        assertTrue(exists, "exists");
    }

    function test_openAccount_onlyOperator() public {
        vm.deal(address(this), 1 ether);
        vm.expectRevert();
        tallo.openAccount{value: 1 ether}(ROUND, AGENT);
    }

    function test_charge_onlyRouter() public {
        _open(1 ether);
        vm.expectRevert();
        tallo.charge(ROUND, AGENT, 0.1 ether);
    }

    function test_charge_succeeds_movesFundsToTreasury() public {
        _open(1 ether);
        uint256 treasuryBefore = treasury.balance;

        vm.expectEmit(true, true, false, true);
        emit Charged(ROUND, AGENT, 0.1 ether, 0.1 ether, 0.9 ether);

        vm.prank(router);
        bool ok = tallo.charge(ROUND, AGENT, 0.1 ether);

        assertTrue(ok, "charge should succeed under cap");
        assertEq(treasury.balance - treasuryBefore, 0.1 ether, "funds settle to treasury");
        (, uint128 spent,,) = tallo.accountOf(ROUND, AGENT);
        assertEq(spent, 0.1 ether, "spent accrues");
    }

    /// The one that matters most: the cap breach must DECLINE, not revert, and the
    /// CappedOut event must be emitted (so the indexer can derive the elimination).
    function test_charge_capBreach_declines_withoutReverting() public {
        _open(1 ether);

        // Spend 0.95, leaving 0.05.
        vm.prank(router);
        tallo.charge(ROUND, AGENT, 0.95 ether);

        // Attempt 0.20 against 0.05 remaining: must decline, emit, and NOT revert.
        vm.expectEmit(true, true, false, true);
        emit CapDeclined(ROUND, AGENT, 0.2 ether, 0.05 ether);
        vm.expectEmit(true, true, false, true);
        emit CappedOut(ROUND, AGENT, 0.95 ether);

        vm.prank(router);
        bool ok = tallo.charge(ROUND, AGENT, 0.2 ether);

        assertFalse(ok, "cap breach returns false");
        (, uint128 spent, bool active,) = tallo.accountOf(ROUND, AGENT);
        assertEq(spent, 0.95 ether, "spend is unchanged by a declined charge");
        assertFalse(active, "the account is eliminated");
    }

    function test_charge_afterCapOut_reverts_missingInactive() public {
        _open(1 ether);
        vm.prank(router);
        tallo.charge(ROUND, AGENT, 0.95 ether);
        vm.prank(router);
        tallo.charge(ROUND, AGENT, 0.2 ether); // caps out

        // Once inactive, further charges revert (guard), they are not a cap decline.
        vm.prank(router);
        vm.expectRevert(bytes("missing/inactive"));
        tallo.charge(ROUND, AGENT, 0.01 ether);
    }

    function test_charge_exactRemaining_succeeds() public {
        _open(1 ether);
        vm.prank(router);
        bool ok = tallo.charge(ROUND, AGENT, 1 ether); // exactly the cap
        assertTrue(ok, "spending exactly the cap is allowed");
        (, uint128 spent, bool active,) = tallo.accountOf(ROUND, AGENT);
        assertEq(spent, 1 ether);
        assertTrue(active, "still active at exactly cap");
    }

    /// Fuzz the cap boundary: for any split, a charge at or under remaining succeeds
    /// and one over declines without reverting. This is the property the demo rests on.
    function testFuzz_capBoundary(uint128 cap, uint128 first, uint128 second) public {
        cap = uint128(bound(cap, 1, 1000 ether));
        first = uint128(bound(first, 0, cap));
        second = uint128(bound(second, 1, type(uint128).max));

        vm.deal(operator, cap);
        vm.prank(operator);
        tallo.openAccount{value: cap}(ROUND, AGENT);

        if (first > 0) {
            vm.prank(router);
            assertTrue(tallo.charge(ROUND, AGENT, first), "first charge under cap");
        }

        uint128 remaining = cap - first;
        vm.prank(router);
        bool ok = tallo.charge(ROUND, AGENT, second);

        if (second > remaining) {
            assertFalse(ok, "over remaining must decline");
            (, uint128 spent, bool active,) = tallo.accountOf(ROUND, AGENT);
            assertEq(spent, first, "declined charge does not move spend");
            assertFalse(active, "declined charge eliminates");
        } else {
            assertTrue(ok, "at or under remaining must succeed");
        }
    }
}
