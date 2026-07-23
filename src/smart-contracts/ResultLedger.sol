// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * ResultLedger.sol
 * Stores the SHA-256 hash of AES-encrypted exam results to ensure tamper-proof auditing.
 * Links new CIDs to old ones to track updates when teachers re-key an exam.
 */
contract ResultLedger {
    
    struct ResultEntry {
        bytes32 resultHash;   // SHA-256 of encrypted result
        string ipfsCID;       // Storage identifier (Path/CID)
        uint256 timestamp;    // Block timestamp
        address submittedBy;  // Student or Teacher (if update)
        bool isUpdate;        // True if result was re-calculated
        uint256 score;        // Cached score
        uint256 totalQuestions;
    }

    // Mapping: (studentAddress => (examIdHash => ResultEntry[]))
    mapping(address => mapping(bytes32 => ResultEntry[])) private _results;

    event ResultSubmitted(address indexed student, bytes32 indexed examIdHash, bytes32 resultHash, string ipfsCID);

    /**
     * Store a new student result or updated result.
     * The history is automatically maintained by pushing to the array.
     */
    function submitResult(
        address student,
        bytes32 examIdHash,
        bytes32 resultHash,
        string calldata ipfsCID,
        uint256 score,
        uint256 totalQuestions
    ) external {
        bool isUpdate = _results[student][examIdHash].length > 0;
        
        ResultEntry memory entry = ResultEntry({
            resultHash: resultHash,
            ipfsCID: ipfsCID,
            timestamp: block.timestamp,
            submittedBy: msg.sender,
            isUpdate: isUpdate,
            score: score,
            totalQuestions: totalQuestions
        });

        _results[student][examIdHash].push(entry);
        emit ResultSubmitted(student, examIdHash, resultHash, ipfsCID);
    }

    /**
     * Retrieve the most recent CID for a student result.
     */
    function getLatestResult(address student, bytes32 examIdHash) external view returns (ResultEntry memory) {
        uint256 count = _results[student][examIdHash].length;
        require(count > 0, "No result found");
        return _results[student][examIdHash][count - 1];
    }

    /**
     * Get the full history of a student's result (useful for auditing changes).
     */
    function getResultHistory(address student, bytes32 examIdHash) external view returns (ResultEntry[] memory) {
        return _results[student][examIdHash];
    }

    function getResultCount(address student, bytes32 examIdHash) external view returns (uint256) {
        return _results[student][examIdHash].length;
    }
}
