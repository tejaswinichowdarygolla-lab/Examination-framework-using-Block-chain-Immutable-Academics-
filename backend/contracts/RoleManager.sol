// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AuditLog.sol";

/**
 * RoleManager.sol — Phase 2 upgrade
 *
 * New additions over baseline:
 *  ✅ Sub-admin support (sub-admin can grant TEACHER/STUDENT roles)
 *  ✅ Admin address injected from deployer (fixed from .env via migration)
 *  ✅ Teacher→Student mapping
 *  ✅ Registration link hash tracking (prevents link reuse on-chain)
 *  ✅ Events for every state change (off-chain indexing)
 */
contract RoleManager {

    // ─── Roles ────────────────────────────────────────────────
    enum Role { NONE, STUDENT, TEACHER, SUB_ADMIN, ADMIN }

    // ─── State ────────────────────────────────────────────────
    mapping(address => Role) private _roles;
    mapping(address => address[]) public teacherStudents;    // teacher → students[]
    mapping(bytes32 => bool) public usedLinks;               // linkHash → consumed

    AuditLog public auditLog;

    // ─── Events ───────────────────────────────────────────────
    event RoleGranted(address indexed user, Role role, address indexed by);
    event RoleRevoked(address indexed user, address indexed by);
    event SubAdminGranted(address indexed user, address indexed by);
    event StudentAssigned(address indexed teacher, address indexed student, address indexed by);
    event LinkConsumed(bytes32 indexed linkHash, address indexed user);

    // ─── Modifiers ────────────────────────────────────────────
    modifier onlyAdmin() {
        require(_roles[msg.sender] == Role.ADMIN, "RoleManager: not admin");
        _;
    }

    modifier onlyAdminOrSubAdmin() {
        require(
            _roles[msg.sender] == Role.ADMIN || _roles[msg.sender] == Role.SUB_ADMIN,
            "RoleManager: not admin or sub-admin"
        );
        _;
    }

    // ─── Constructor ──────────────────────────────────────────
    /**
     * @param _adminAddress  The permanent admin wallet (from .env / migration)
     * @param _auditLog      Deployed AuditLog contract address
     */
    constructor(address _adminAddress, address _auditLog) {
        require(_adminAddress != address(0), "RoleManager: zero admin address");
        _roles[_adminAddress] = Role.ADMIN;
        auditLog = AuditLog(_auditLog);
        auditLog.logEvent("System", _adminAddress, "Admin initialized");
        emit RoleGranted(_adminAddress, Role.ADMIN, _adminAddress);
    }

    // ─── Role Getters ─────────────────────────────────────────
    function getRole(address user) external view returns (string memory) {
        Role r = _roles[user];
        if (r == Role.ADMIN)     return "ADMIN";
        if (r == Role.SUB_ADMIN) return "SUB_ADMIN";
        if (r == Role.TEACHER)   return "TEACHER";
        if (r == Role.STUDENT)   return "STUDENT";
        return "NONE";
    }

    function getRoleEnum(address user) external view returns (Role) {
        return _roles[user];
    }

    function isAdmin(address user) external view returns (bool) {
        return _roles[user] == Role.ADMIN;
    }

    function isSubAdmin(address user) external view returns (bool) {
        return _roles[user] == Role.SUB_ADMIN;
    }

    function isTeacher(address user) external view returns (bool) {
        return _roles[user] == Role.TEACHER;
    }

    function isStudent(address user) external view returns (bool) {
        return _roles[user] == Role.STUDENT;
    }

    // ─── Sub-Admin Management (Admin only) ────────────────────
    function grantSubAdmin(address user) external onlyAdmin {
        require(_roles[user] == Role.NONE, "RoleManager: already has a role");
        _roles[user] = Role.SUB_ADMIN;
        auditLog.logEvent("SubAdminGranted", user, "Admin granted SUB_ADMIN role");
        emit SubAdminGranted(user, msg.sender);
        emit RoleGranted(user, Role.SUB_ADMIN, msg.sender);
    }

    // ─── Teacher Management (Admin or SubAdmin) ───────────────
    function grantTeacher(address user) external onlyAdminOrSubAdmin {
        require(_roles[user] == Role.NONE, "RoleManager: address already has a role");
        _roles[user] = Role.TEACHER;
        auditLog.logEvent("RoleGranted", user, "Granted TEACHER role");
        emit RoleGranted(user, Role.TEACHER, msg.sender);
    }

    // ─── Student Management (Admin, SubAdmin, or Teacher) ─────
    function grantStudent(address user) external {
        require(
            _roles[msg.sender] == Role.ADMIN ||
            _roles[msg.sender] == Role.SUB_ADMIN ||
            _roles[msg.sender] == Role.TEACHER,
            "RoleManager: insufficient privileges"
        );
        require(_roles[user] == Role.NONE, "RoleManager: address already has a role");
        _roles[user] = Role.STUDENT;
        auditLog.logEvent("RoleGranted", user, "Granted STUDENT role");
        emit RoleGranted(user, Role.STUDENT, msg.sender);
    }

    // ─── Teacher→Student Assignment ───────────────────────────
    function assignStudentToTeacher(address teacher, address student) external onlyAdminOrSubAdmin {
        require(_roles[teacher] == Role.TEACHER, "RoleManager: not a teacher");
        require(_roles[student] == Role.STUDENT, "RoleManager: not a student");
        teacherStudents[teacher].push(student);
        auditLog.logEvent("StudentAssigned", student, "Assigned to teacher");
        emit StudentAssigned(teacher, student, msg.sender);
    }

    function getTeacherStudents(address teacher) external view returns (address[] memory) {
        return teacherStudents[teacher];
    }

    // ─── Registration Link Tracking ───────────────────────────
    /**
     * Mark a registration link as consumed on-chain.
     * linkHash = keccak256(linkId encoded as bytes)
     */
    function consumeLink(bytes32 linkHash, address user) external onlyAdminOrSubAdmin {
        require(!usedLinks[linkHash], "RoleManager: link already consumed");
        usedLinks[linkHash] = true;
        emit LinkConsumed(linkHash, user);
    }

    // ─── Revoke ───────────────────────────────────────────────
    function revokeRole(address user) external onlyAdmin {
        require(user != msg.sender, "RoleManager: cannot revoke own admin role");
        require(_roles[user] != Role.NONE, "RoleManager: address has no role");
        _roles[user] = Role.NONE;
        auditLog.logEvent("RoleRevoked", user, "Admin revoked role");
        emit RoleRevoked(user, msg.sender);
    }
}
