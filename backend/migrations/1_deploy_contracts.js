const AuditLog      = artifacts.require("AuditLog");
const RoleManager   = artifacts.require("RoleManager");
const ExamManager   = artifacts.require("ExamManager");
const ResultLedger  = artifacts.require("ResultLedger");
const FeeVault      = artifacts.require("FeeVault");

const fs   = require('fs');
const path = require('path');

// Admin address injected from environment variable at deploy time
// Set ADMIN_ADDRESS env var before running: ADMIN_ADDRESS=0x... truffle migrate
const ADMIN_ADDRESS =
  process.env.ADMIN_ADDRESS ||
  '0x76Cb9ceB5ae1E2f14c6781053D3896527d26FA14'; // fallback to known dev admin

module.exports = async function (deployer, network, accounts) {
  const deployer_addr = accounts[0];
  console.log('='.repeat(60));
  console.log('Deploying ChainEdu Contracts');
  console.log('Network      :', network);
  console.log('Deployer     :', deployer_addr);
  console.log('Admin address:', ADMIN_ADDRESS);
  console.log('='.repeat(60));

  // 1. Deploy AuditLog
  await deployer.deploy(AuditLog);
  const auditLog = await AuditLog.deployed();
  console.log('✅ AuditLog   :', auditLog.address);

  // 2. Deploy RoleManager (admin address injected — different from deployer!)
  await deployer.deploy(RoleManager, ADMIN_ADDRESS, auditLog.address);
  const roleManager = await RoleManager.deployed();
  console.log('✅ RoleManager:', roleManager.address);

  // 3. Deploy ExamManager
  await deployer.deploy(ExamManager, roleManager.address, auditLog.address);
  const examManager = await ExamManager.deployed();
  console.log('✅ ExamManager:', examManager.address);

  // 4. Deploy ResultLedger
  await deployer.deploy(ResultLedger, roleManager.address, auditLog.address);
  const resultLedger = await ResultLedger.deployed();
  console.log('✅ ResultLedger:', resultLedger.address);

  // 5. Deploy FeeVault
  await deployer.deploy(FeeVault, roleManager.address, auditLog.address);
  const feeVault = await FeeVault.deployed();
  console.log('✅ FeeVault   :', feeVault.address);

  console.log('='.repeat(60));

  // ── Write addresses.json to frontend ─────────────────────
  const frontendContractsDir = path.join(__dirname, '..', '..', 'src', 'contracts');
  if (!fs.existsSync(frontendContractsDir)) {
    fs.mkdirSync(frontendContractsDir, { recursive: true });
  }

  const addresses = {
    AuditLog:     auditLog.address,
    RoleManager:  roleManager.address,
    ExamManager:  examManager.address,
    ResultLedger: resultLedger.address,
    FeeVault:     feeVault.address,
    deployedAt:   new Date().toISOString(),
    network,
    adminAddress: ADMIN_ADDRESS,
  };

  fs.writeFileSync(
    path.join(frontendContractsDir, 'addresses.json'),
    JSON.stringify(addresses, null, 2),
  );
  console.log('✅ addresses.json written to src/contracts/');

  // ── Copy ABIs to frontend ─────────────────────────────────
  const abiDir = path.join(frontendContractsDir, 'abis');
  if (!fs.existsSync(abiDir)) {
    fs.mkdirSync(abiDir, { recursive: true });
  }

  const contracts = ['AuditLog', 'RoleManager', 'ExamManager', 'ResultLedger', 'FeeVault'];
  for (const name of contracts) {
    const buildPath = path.join(__dirname, '..', 'build', 'contracts', `${name}.json`);
    if (fs.existsSync(buildPath)) {
      const artifact = require(buildPath);
      fs.writeFileSync(
        path.join(abiDir, `${name}.json`),
        JSON.stringify(artifact.abi, null, 2),
      );
      console.log(`✅ ABI copied: ${name}.json`);
    }
  }

  console.log('='.repeat(60));
  console.log('🎉 All contracts deployed successfully!');
  console.log('Next: cd .. && npm run dev');
  console.log('='.repeat(60));
};
