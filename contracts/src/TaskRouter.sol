// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Tallo} from "./Tallo.sol";

/// @title TaskRouter, the rules of the task and the score ledger.
/// @notice One paid entrypoint, pay(). Scoring is on chain from the posted table, so
///         there is no separate reportScore round trip: one pay() equals one on-chain
///         receipt (the Stub event). pay() mirrors Tallo's decline and returns false
///         on a cap breach, it never reverts.
contract TaskRouter {
    struct Task {
        uint128 basePrice;
        uint128 premiumPrice; // 0 if untiered
        uint32 baseScore;
        uint32 premiumScore;
        // Table-driven conditional bonus: if bonusTaskId was completed by this agent,
        // award bonusScore. This is how the rubric's "PUBLISH +5 if VERIFY done" stays
        // fully on chain and table-driven. bonusTaskId == 0 means no bonus.
        bytes32 bonusTaskId;
        uint32 bonusScore;
        bool required;
        bool exists;
    }

    enum Tier {
        BASE,
        PREMIUM
    }

    Tallo public immutable tallo;
    address public immutable operator;

    mapping(bytes32 => mapping(bytes32 => Task)) private _tasks; // roundId => taskId => Task
    mapping(bytes32 => mapping(bytes32 => address)) public controller; // roundId => agentId => spender
    mapping(bytes32 => mapping(bytes32 => uint64)) public scoreOf; // roundId => agentId => cumulative score
    mapping(bytes32 => mapping(bytes32 => mapping(bytes32 => bool))) public completed; // no double-bill

    event TaskListed(bytes32 indexed roundId, bytes32 indexed taskId, uint128 basePrice, uint128 premiumPrice);
    event ControllerAssigned(bytes32 indexed roundId, bytes32 indexed agentId, address controller);
    event Stub(
        bytes32 indexed roundId,
        bytes32 indexed agentId,
        bytes32 indexed taskId,
        Tier tier,
        uint128 price,
        uint32 score,
        uint64 cumulativeScore
    );
    event PaymentDeclined(bytes32 indexed roundId, bytes32 indexed agentId, bytes32 indexed taskId, Tier tier);
    event RunFinished(bytes32 indexed roundId, bytes32 indexed agentId, uint64 totalScore);

    modifier onlyOperator() {
        if (msg.sender != operator) revert();
        _;
    }

    constructor(Tallo _tallo, address _operator) {
        require(address(_tallo) != address(0) && _operator != address(0), "zero addr");
        tallo = _tallo;
        operator = _operator;
    }

    /// @notice Post a subtask's prices and scores for a round. Operator only.
    function listTask(bytes32 roundId, bytes32 taskId, Task calldata task) external onlyOperator {
        _tasks[roundId][taskId] = Task(
            task.basePrice,
            task.premiumPrice,
            task.baseScore,
            task.premiumScore,
            task.bonusTaskId,
            task.bonusScore,
            task.required,
            true
        );
        emit TaskListed(roundId, taskId, task.basePrice, task.premiumPrice);
    }

    /// @notice Assign the address permitted to spend for an agent (the orchestrator key).
    function assignController(bytes32 roundId, bytes32 agentId, address spender) external onlyOperator {
        controller[roundId][agentId] = spender;
        emit ControllerAssigned(roundId, agentId, spender);
    }

    /// @notice The one paid entrypoint. Returns false on decline, does NOT revert.
    function pay(bytes32 roundId, bytes32 agentId, bytes32 taskId, Tier tier) external returns (bool ok) {
        require(msg.sender == controller[roundId][agentId], "not controller");
        Task memory t = _tasks[roundId][taskId];
        require(t.exists && !completed[roundId][agentId][taskId], "unknown/done");
        uint128 price = tier == Tier.PREMIUM ? t.premiumPrice : t.basePrice;
        require(price > 0, "tier unavailable");

        ok = tallo.charge(roundId, agentId, price); // cap enforced here
        if (!ok) {
            emit PaymentDeclined(roundId, agentId, taskId, tier); // mirror, no revert
            return false;
        }

        completed[roundId][agentId][taskId] = true;
        uint32 base = tier == Tier.PREMIUM ? t.premiumScore : t.baseScore;
        uint32 bonus =
            (t.bonusTaskId != bytes32(0) && completed[roundId][agentId][t.bonusTaskId]) ? t.bonusScore : 0;
        uint32 score = base + bonus;
        uint64 cum = scoreOf[roundId][agentId] + score;
        scoreOf[roundId][agentId] = cum;
        emit Stub(roundId, agentId, taskId, tier, price, score, cum);
    }

    /// @notice Close a lane, freezing its total. Emits the RunFinished beat.
    function finish(bytes32 roundId, bytes32 agentId) external onlyOperator {
        emit RunFinished(roundId, agentId, scoreOf[roundId][agentId]);
    }

    /// @notice Read a posted task. Used by tests and the host's integrity echo.
    function taskOf(bytes32 roundId, bytes32 taskId) external view returns (Task memory) {
        return _tasks[roundId][taskId];
    }
}
