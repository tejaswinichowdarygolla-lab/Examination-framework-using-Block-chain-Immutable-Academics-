import { useCallback } from 'react';
import addresses from '../contracts/addresses.json';

const ABI_MODULES: any = import.meta.glob('../contracts/abis/*.json', { eager: true });

function getABI(contractName: string) {
  const key = `../contracts/abis/${contractName}.json`;
  const mod = ABI_MODULES[key];
  if (!mod) throw new Error(`ABI not found for ${contractName}. Run truffle migrate first.`);
  return mod.default ?? mod;
}

export const useContract = (web3: any) => {
  const getContract = useCallback(async (contractName: string) => {
    if (!web3) return null;
    try {
      const abi = getABI(contractName);
      const address = (addresses as any)[contractName];
      if (!address) throw new Error(`${contractName} address not found in addresses.json`);
      return new web3.eth.Contract(abi, address);
    } catch {
      return null;
    }
  }, [web3]);

  const getRoleManager  = useCallback(() => getContract('RoleManager'),  [getContract]);
  const getExamManager  = useCallback(() => getContract('ExamManager'),   [getContract]);
  const getAuditLog     = useCallback(() => getContract('AuditLog'),      [getContract]);
  const getResultLedger = useCallback(() => getContract('ResultLedger'),  [getContract]);
  const getFeeVault     = useCallback(() => getContract('FeeVault'),      [getContract]);

  return { getContract, getRoleManager, getExamManager, getAuditLog, getResultLedger, getFeeVault };
};
