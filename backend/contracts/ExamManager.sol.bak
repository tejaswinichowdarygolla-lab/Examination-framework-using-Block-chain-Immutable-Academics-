// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RoleManager.sol";
import "./AuditLog.sol";

/**
 * ExamManager.sol — Phase 2 upgrade
 *
 * New additions:
 *  ✅ Full exam struct: encrypted CID, answer CID, schedule, allowed students
 *  ✅ Scheduled start time enforcement
 *  ✅ Allowed-student list per exam
 *  ✅ Teacher-controlled student restart permission
 *  ✅ Network-loss restart logging (max 3 disconnects)
 *  ✅ Events for frontend subscriptions
 */
contract ExamManager {

    RoleManager public roleManager;
    AuditLog    public auditLog;

    // ─── Structs ──────────────────────────────────────────────
    struct Exam {
        string   encryptedPaperCID;   // AES-encrypted paper stored in IPFS
        string   encryptedAnswerCID;  // AES-encrypted answer key
        address  teacher;
        string   name;
        uint256  startTime;           // Unix timestamp
        uint256  duration;            // Seconds
        bool     active;
        address[] allowedStudents;
    }

    struct StudentExamState {
        bool     restartAllowed;      // teacher permits restart
        uint8    disconnectCount;     // incremented on each network loss restart
        bool     submitted;
        bool     paused;              // SEC-TC-030: Teacher can pause session
    }

    // ─── Storage ──────────────────────────────────────────────
    mapping(uint256 => Exam) public exams;
    uint256 public examCount;
    uint256 public constant MAX_STUDENTS = 200; // SEC-TC-017: Prevent gas griefing

    // examId => studentAddr => state
    mapping(uint256 => mapping(address => StudentExamState)) public studentExamStates;

    // ─── Events ───────────────────────────────────────────────
    event ExamScheduled(uint256 indexed examId, address indexed teacher, uint256 startTime, uint256 duration);
    event ExamUpdated(uint256 indexed examId, address indexed teacher);
    event StudentRestartAllowed(uint256 indexed examId, address indexed student, address indexed teacher);
    event StudentDisconnectLogged(uint256 indexed examId, address indexed student, uint8 disconnectCount);
    event ExamStatusToggled(uint256 indexed examId, bool active);

    // ─── Modifiers ────────────────────────────────────────────
    modifier onlyTeacher() {
        require(roleManager.isTeacher(msg.sender), "ExamManager: not a teacher");
        _;
    }

    modifier onlyAdminOrTeacher() {
        require(
            roleManager.isAdmin(msg.sender) || roleManager.isTeacher(msg.sender),
            "ExamManager: not admin or teacher"
        );
        _;
    }

    modifier examExists(uint256 examId) {
        require(examId > 0 && examId <= examCount, "ExamManager: exam not found");
        _;
    }

    modifier onlyExamTeacher(uint256 examId) {
        require(exams[examId].teacher == msg.sender, "ExamManager: not exam's teacher");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────
    constructor(address _roleManager, address _auditLog) {
        roleManager = RoleManager(_roleManager);
        auditLog    = AuditLog(_auditLog);
    }

    // ─── Teacher: Schedule exam ───────────────────────────────
    function scheduleExam(
        string  calldata encryptedPaperCID,
        string  calldata encryptedAnswerCID,
        string  calldata name,
        uint256 startTime,
        uint256 duration,
        address[] calldata allowedStudents
    ) external onlyTeacher returns (uint256 examId) {
        require(startTime > block.timestamp, "ExamManager: start time must be in future");
        require(duration > 0, "ExamManager: duration must be > 0");
        require(bytes(encryptedPaperCID).length > 0, "ExamManager: paper CID required");
        // SEC-TC-017: Gas griefing check
        require(allowedStudents.length <= MAX_STUDENTS, "ExamManager: student list exceeds 200 limit");

        examCount++;
        examId = examCount;

        exams[examId] = Exam({
            encryptedPaperCID: encryptedPaperCID,
            encryptedAnswerCID: encryptedAnswerCID,
            teacher: msg.sender,
            name: name,
            startTime: startTime,
            duration: duration,
            active: true,
            allowedStudents: allowedStudents
        });

        auditLog.logEvent("ExamScheduled", msg.sender, name);
        emit ExamScheduled(examId, msg.sender, startTime, duration);
    }

    // ─── Teacher: Update answer CID (after re-evaluation) ────
    function updateAnswerCID(
        uint256 examId,
        string calldata newAnswerCID
    ) external examExists(examId) onlyExamTeacher(examId) {
        // SEC-TC-022: Prevent updates during or right before exam (30 min lock)
        require(
            block.timestamp < exams[examId].startTime - 30 minutes, 
            "ExamManager: updates locked (window closes 30m before start)"
        );

        exams[examId].encryptedAnswerCID = newAnswerCID;
        auditLog.logEvent("AnswerCIDUpdated", msg.sender, exams[examId].name);
        emit ExamUpdated(examId, msg.sender);
    }

    // ─── Teacher: Permit student restart ─────────────────────
    function permitStudentRestart(
        uint256 examId,
        address student
    ) external examExists(examId) onlyExamTeacher(examId) {
        require(isAllowed(examId, student), "ExamManager: student not in exam");
        studentExamStates[examId][student].restartAllowed = true;
        auditLog.logEvent("RestartPermitted", student, exams[examId].name);
        emit StudentRestartAllowed(examId, student, msg.sender);
    }

    // ─── Student: Log network disconnect ──────────────────────
    function logDisconnect(uint256 examId) external examExists(examId) {
        require(isAllowed(examId, msg.sender), "ExamManager: not in exam");
        StudentExamState storage s = studentExamStates[examId][msg.sender];
        s.disconnectCount++;
        auditLog.logEvent("NetworkDisconnect", msg.sender, exams[examId].name);
        emit StudentDisconnectLogged(examId, msg.sender, s.disconnectCount);
    }

    // ─── Student: Consume restart permission ──────────────────
    function consumeRestart(uint256 examId) external examExists(examId) {
        StudentExamState storage s = studentExamStates[examId][msg.sender];
        require(s.restartAllowed, "ExamManager: restart not permitted");
        s.restartAllowed = false;
        s.disconnectCount = 0;
        auditLog.logEvent("RestartConsumed", msg.sender, exams[examId].name);
    }

    // ─── Student: Mark submitted ──────────────────────────────
    function markSubmitted(uint256 examId) external examExists(examId) {
        require(isAllowed(examId, msg.sender), "ExamManager: not in exam");
        require(isExamLive(examId), "ExamManager: exam not active");
        studentExamStates[examId][msg.sender].submitted = true;
        auditLog.logEvent("ExamSubmitted", msg.sender, exams[examId].name);
    }

    // ─── Toggle exam active status ────────────────────────────
    function toggleExamStatus(uint256 examId)
        external examExists(examId) onlyExamTeacher(examId)
    {
        exams[examId].active = !exams[examId].active;
        emit ExamStatusToggled(examId, exams[examId].active);
    }

    // ─── Teacher: Pause/Resume specific student (SEC-TC-030) ──
    function toggleStudentPause(uint256 examId, address student)
        external examExists(examId) onlyExamTeacher(examId)
    {
        studentExamStates[examId][student].paused = !studentExamStates[examId][student].paused;
        auditLog.logEvent(
            studentExamStates[examId][student].paused ? "StudentPaused" : "StudentResumed",
            student,
            exams[examId].name
        );
    }

    // ─── View helpers ─────────────────────────────────────────
    function isAllowed(uint256 examId, address student) public view returns (bool) {
        address[] memory students = exams[examId].allowedStudents;
        for (uint i = 0; i < students.length; i++) {
            if (students[i] == student) return true;
        }
        return false;
    }

    function isExamLive(uint256 examId) public view returns (bool) {
        Exam memory e = exams[examId];
        return (
            e.active &&
            block.timestamp >= e.startTime &&
            block.timestamp <= e.startTime + e.duration
        );
    }

    function canStudentStart(uint256 examId, address student) external view returns (bool) {
        StudentExamState memory s = studentExamStates[examId][student];
        // SEC-TC-020: Lockout after 3 disconnects
        bool notLocked = s.disconnectCount < 3;
        // SEC-TC-030: Pause check
        bool notPaused = !s.paused;
        
        return isAllowed(examId, student) && isExamLive(examId) &&
               !s.submitted && notLocked && notPaused;
    }

    function getExam(uint256 examId) external view returns (
        string memory paperCID,
        string memory answerCID,
        address teacher,
        string memory name,
        uint256 startTime,
        uint256 duration,
        bool active
    ) {
        Exam memory e = exams[examId];
        return (e.encryptedPaperCID, e.encryptedAnswerCID, e.teacher, e.name, e.startTime, e.duration, e.active);
    }

    function getAllowedStudents(uint256 examId) external view returns (address[] memory) {
        return exams[examId].allowedStudents;
    }

    function getStudentState(uint256 examId, address student)
        external view returns (bool restartAllowed, uint8 disconnectCount, bool submitted)
    {
        StudentExamState memory s = studentExamStates[examId][student];
        return (s.restartAllowed, s.disconnectCount, s.submitted);
    }
}
