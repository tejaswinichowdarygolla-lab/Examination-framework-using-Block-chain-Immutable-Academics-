// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IExamManager {
    function getExam(uint256 examId) external view returns (string memory, string memory, address, string memory, uint256, uint256, bool);
}
