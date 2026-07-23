// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RoleManager.sol";
import "./AuditLog.sol";
import "./IExamManager.sol";

/**
 * FeeVault.sol — Phase 2 upgrade
 */
contract FeeVault {

    RoleManager public roleManager;
    AuditLog    public auditLog;
    address     public examManager;

    uint256 public constant UPDATE_FEE = 0.001 ether;

    mapping(address => uint256) public totalCharged;

    event TeacherCharged(address indexed teacher, uint256 amount, uint256 indexed examId);
    event FeesWithdrawn(address indexed admin, uint256 amount);

    modifier onlyAdmin() {
        require(roleManager.isAdmin(msg.sender), "FeeVault: not admin");
        _;
    }

    modifier onlyTeacher() {
        require(roleManager.isTeacher(msg.sender), "FeeVault: not teacher");
        _;
    }

    constructor(address _roleManager, address _auditLog, address _examManager) {
        roleManager = RoleManager(_roleManager);
        auditLog    = AuditLog(_auditLog);
        examManager = _examManager;
    }

    function chargeTeacher(uint256 examId) external payable onlyTeacher {
        require(msg.value == UPDATE_FEE, "FeeVault: must send exactly 0.001 ETH");
        
        // SEC-TC-008: Verify msg.sender is the teacher of this specifically referenced exam
        (, , address teacher, , , , ) = IExamManager(examManager).getExam(examId);
        require(msg.sender == teacher, "FeeVault: not the registered teacher for this exam");

        totalCharged[msg.sender] += msg.value;
        auditLog.logEvent(
            "TeacherCharged",
            msg.sender,
            string(abi.encodePacked("Answer update fee for exam ", _uint2str(examId)))
        );
        emit TeacherCharged(msg.sender, msg.value, examId);
    }

    function withdraw() external onlyAdmin {
        uint256 balance = address(this).balance;
        require(balance > 0, "FeeVault: no balance");
        (bool ok, ) = payable(msg.sender).call{value: balance}("");
        require(ok, "FeeVault: transfer failed");
        emit FeesWithdrawn(msg.sender, balance);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function _uint2str(uint256 n) internal pure returns (string memory) {
        if (n == 0) return "0";
        uint256 j = n; uint256 len;
        while (j != 0) { len++; j /= 10; }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (n != 0) {
            k--;
            bstr[k] = bytes1(uint8(48 + (n % 10)));
            n /= 10;
        }
        return string(bstr);
    }
}
