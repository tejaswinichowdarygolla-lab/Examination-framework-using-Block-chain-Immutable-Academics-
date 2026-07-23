/**
 * ChainEdu Nexus — Automated Smart Contract Deployer
 * Targets: Ganache / local testnet
 */
const { Web3 } = require('web3');
const fs = require('fs');
const path = require('path');

const RPC_URL = 'http://127.0.0.1:7545';
const web3 = new Web3(RPC_URL);

const CONTRACT_DIR = path.resolve(__dirname, '../src/contracts/abis');
const OUTPUT_FILE = path.resolve(__dirname, '../src/contracts/addresses.json');

const loadABI = (name) => {
  const content = fs.readFileSync(path.join(CONTRACT_DIR, `${name}.json`), 'utf8');
  return JSON.parse(content);
};

async function deploy() {
  try {
    const accounts = await web3.eth.getAccounts();
    const admin = accounts[0];
    console.log("[Deployer] Initializing with Admin:", admin);

    // 1. Audit Log (0 args)
    const auditLogABI = loadABI('AuditLog');
    const auditLog = await new web3.eth.Contract(auditLogABI.abi)
      .deploy({ data: auditLogABI.bytecode })
      .send({ from: admin, gas: 5000000 });
    console.log("[Deployer] AuditLog @", auditLog.options.address);

    // 2. Role Manager (2 args: admin, auditLog)
    const roleManagerABI = loadABI('RoleManager');
    const roleManager = await new web3.eth.Contract(roleManagerABI.abi)
      .deploy({ data: roleManagerABI.bytecode, arguments: [admin, auditLog.options.address] })
      .send({ from: admin, gas: 5000000 });
    console.log("[Deployer] RoleManager @", roleManager.options.address);

    // 3. Exam Manager (2 args: roleManager, auditLog)
    const examManagerABI = loadABI('ExamManager');
    const examManager = await new web3.eth.Contract(examManagerABI.abi)
      .deploy({ data: examManagerABI.bytecode, arguments: [roleManager.options.address, auditLog.options.address] })
      .send({ from: admin, gas: 5000000 });
    console.log("[Deployer] ExamManager @", examManager.options.address);

    // 4. Fee Vault (3 args: roleManager, auditLog, examManager)
    const feeVaultABI = loadABI('FeeVault');
    const feeVault = await new web3.eth.Contract(feeVaultABI.abi)
      .deploy({ data: feeVaultABI.bytecode, arguments: [roleManager.options.address, auditLog.options.address, examManager.options.address] })
      .send({ from: admin, gas: 5000000 });
    console.log("[Deployer] FeeVault @", feeVault.options.address);

    // 5. Result Ledger (4 args: roleManager, auditLog, examManager, feeVault)
    const resultLedgerABI = loadABI('ResultLedger');
    const resultLedger = await new web3.eth.Contract(resultLedgerABI.abi)
      .deploy({ data: resultLedgerABI.bytecode, arguments: [roleManager.options.address, auditLog.options.address, examManager.options.address, feeVault.options.address] })
      .send({ from: admin, gas: 5000000 });
    console.log("[Deployer] ResultLedger @", resultLedger.options.address);

    const addresses = {
      RoleManager: roleManager.options.address,
      AuditLog: auditLog.options.address,
      FeeVault: feeVault.options.address,
      ExamManager: examManager.options.address,
      ResultLedger: resultLedger.options.address,
      deployedAt: new Date().toISOString(),
      network: "Ganache-7545",
      adminAddress: admin
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(addresses, null, 2));
    console.log("[Deployer] SUCCESS: Addresses saved.");

  } catch (err) {
    console.error("[Deployer] FATAL:", err);
  }
}

deploy();
