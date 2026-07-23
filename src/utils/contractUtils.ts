import Web3 from 'web3';
import addresses from '@/contracts/addresses.json';
import ResultLedgerABI from '@/contracts/abis/ResultLedger.json';
import RoleManagerABI from '@/contracts/abis/RoleManager.json';
import ExamManagerABI from '@/contracts/abis/ExamManager.json';

const getEthereum = () => (window as any).ethereum;

export const getWeb3 = () => {
  const eth = getEthereum();
  return eth ? new Web3(eth) : null;
};

export const getContract = (name: keyof typeof addresses, abi: any) => {
  const web3 = getWeb3();
  if (!web3) return null;
  const address = (addresses as any)[name];
  return new web3.eth.Contract(abi, address);
};

export const ResultLedgerContract = () => getContract('ResultLedger', ResultLedgerABI);
export const RoleManagerContract = () => getContract('RoleManager', RoleManagerABI);
export const ExamManagerContract = () => getContract('ExamManager', ExamManagerABI);

/**
 * Converts a string (like ExamName) to a bytes32 hash (Keccak256).
 */
export const toBytes32 = (input: string) => {
  const web3 = new Web3();
  return web3.utils.keccak256(input);
};
