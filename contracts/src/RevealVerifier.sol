// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Ring 3 interface (the cut line). The winner posts one Noir proof at settle:
///         it reached the quality target under cap via a route matching an earlier
///         commitment, without revealing the route. RevealVerified is the only event
///         the frontend ever needs from Ring 3, so cutting Ring 3 removes exactly one
///         component (ProofTick) and nothing else.
interface INoirVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}

contract RevealVerifier {
    event RevealVerified(bytes32 indexed roundId, bytes32 indexed agentId, bool ok);

    INoirVerifier public immutable verifier;

    constructor(INoirVerifier _verifier) {
        verifier = _verifier;
    }

    function reveal(bytes32 roundId, bytes32 agentId, bytes calldata proof, bytes32[] calldata pub) external {
        emit RevealVerified(roundId, agentId, verifier.verify(proof, pub)); // green tick, route hidden
    }
}
