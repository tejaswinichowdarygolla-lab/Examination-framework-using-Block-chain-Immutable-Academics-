// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * AuditLog.sol
 *
 * Append-only, on-chain event log.
 * No function to delete entries — immutability guaranteed.
 *
 * Events emitted on every write so off-chain indexers can track them.
 */
contract AuditLog {
    struct LogEntry {
        string   eventType;    // e.g. "RoleGranted", "ExamSubmitted"
        address  actor;        // who triggered it
        string   description;  // human-readable detail
        uint256  timestamp;    // block.timestamp
    }

    LogEntry[] private _entries;

    event EventLogged(
        uint256 indexed id,
        string  eventType,
        address indexed actor,
        string  description,
        uint256 timestamp
    );

    function logEvent(
        string calldata eventType,
        address actor,
        string calldata description
    ) external {
        uint256 id = _entries.length;
        _entries.push(LogEntry(eventType, actor, description, block.timestamp));
        emit EventLogged(id, eventType, actor, description, block.timestamp);
    }

    function getEntryCount() external view returns (uint256) {
        return _entries.length;
    }

    function getEntry(uint256 id) external view returns (LogEntry memory) {
        require(id < _entries.length, "AuditLog: out of range");
        return _entries[id];
    }
}
