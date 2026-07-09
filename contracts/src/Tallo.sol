// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Tallo, the ledger.
/// @notice Per-agent budgets, hard-capped, charged in real time. The one law: on a
///         cap breach charge() DECLINES (returns false and emits), it never reverts.
///         A reverted transaction persists no logs on X Layer, so a revert here would
///         discard the very CappedOut event the leaderboard is derived from.
contract Tallo {
    struct Account {
        uint128 cap; // budget ceiling for the round
        uint128 spent; // cumulative spend
        bool active; // false once capped out or settled
        bool exists;
    }

    // router is set once after deploy (initRouter) to break the Tallo <-> Router
    // deploy cycle, then frozen by the zero-address guard. Same guarantee as
    // immutable, without the CREATE2 dance.
    address public router; // only the router may charge
    address public immutable operator; // opens, funds, settles
    address public immutable treasury; // where charged funds settle

    mapping(bytes32 => mapping(bytes32 => Account)) private _accounts; // roundId => agentId => Account

    event AccountOpened(bytes32 indexed roundId, bytes32 indexed agentId, uint128 cap);
    event Charged(
        bytes32 indexed roundId, bytes32 indexed agentId, uint128 amount, uint128 spent, uint128 remaining
    );
    event CapDeclined(bytes32 indexed roundId, bytes32 indexed agentId, uint128 attempted, uint128 remaining);
    event CappedOut(bytes32 indexed roundId, bytes32 indexed agentId, uint128 totalSpent);
    event RouterSet(address indexed router);

    modifier onlyRouter() {
        if (msg.sender != router) revert();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert();
        _;
    }

    constructor(address _operator, address _treasury) {
        require(_operator != address(0) && _treasury != address(0), "zero addr");
        operator = _operator;
        treasury = _treasury;
    }

    /// @notice Wire the router once, after both contracts are deployed. Set-once.
    function initRouter(address _router) external onlyOperator {
        require(router == address(0), "router set");
        require(_router != address(0), "zero addr");
        router = _router;
        emit RouterSet(_router);
    }

    /// @notice Open and fund an account. fund == cap: the value sent is the ceiling.
    function openAccount(bytes32 roundId, bytes32 agentId) external payable onlyOperator {
        require(msg.value > 0, "fund == cap");
        require(!_accounts[roundId][agentId].exists, "exists");
        _accounts[roundId][agentId] = Account(uint128(msg.value), 0, true, true);
        emit AccountOpened(roundId, agentId, uint128(msg.value));
    }

    /// @notice Charge the account. The spine of the design.
    /// @return ok false == the cap declined (elimination). Does NOT revert on a breach.
    function charge(bytes32 roundId, bytes32 agentId, uint128 amount) external onlyRouter returns (bool ok) {
        Account storage a = _accounts[roundId][agentId];
        require(a.exists && a.active, "missing/inactive");
        uint128 remaining = a.cap - a.spent;
        if (amount > remaining) {
            a.active = false; // eliminate
            emit CapDeclined(roundId, agentId, amount, remaining);
            emit CappedOut(roundId, agentId, a.spent);
            return false; // decline, do not revert: the event IS the drama, and it persists
        }
        a.spent += amount;
        // Native OKB settlement. Swap this call site for token.transfer(treasury, amount)
        // for a USDC mainnet framing. Add a ReentrancyGuard before mainnet: treasury is
        // a known operator address here, so the call is safe for the testnet demo.
        (bool sent,) = treasury.call{value: amount}("");
        require(sent, "transfer failed");
        emit Charged(roundId, agentId, amount, a.spent, a.cap - a.spent);
        return true;
    }

    /// @notice Freeze an account at round close.
    function settle(bytes32 roundId, bytes32 agentId) external onlyOperator {
        _accounts[roundId][agentId].active = false;
    }

    /// @notice Read an account. Used by tests and the orchestrator's buildState.
    function accountOf(bytes32 roundId, bytes32 agentId)
        external
        view
        returns (uint128 cap, uint128 spent, bool active, bool exists)
    {
        Account memory a = _accounts[roundId][agentId];
        return (a.cap, a.spent, a.active, a.exists);
    }
}
