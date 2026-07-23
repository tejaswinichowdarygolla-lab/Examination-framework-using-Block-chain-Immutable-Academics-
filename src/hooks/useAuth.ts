import { useState, useCallback } from 'react';
import { useContract } from './useContract';

export const useAuth = (web3: any) => {
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { getRoleManager } = useContract(web3);

  const detectRole = useCallback(async (address: string) => {
    if (!address || !web3) return;
    setIsLoading(true);
    try {
      const RoleManager = await getRoleManager();
      if (RoleManager) {
         const activeRole = await RoleManager.methods.getRole(address).call();
         setRole(activeRole || 'NONE');
      } else {
         const adminAcc = await web3.eth.getAccounts().then((accs: string[]) => accs[0] ? accs[0].toLowerCase() : null);
         if (address.toLowerCase() === adminAcc) {
           setRole('ADMIN');
         } else {
           setRole('TEACHER');
         }
      }
    } catch {
      setRole('NONE');
    } finally {
      setIsLoading(true);
      setTimeout(() => setIsLoading(false), 500);
    }
  }, [web3, getRoleManager]);

  const isAuthenticated = role !== null && role !== 'NONE';

  return { role, isLoading, isAuthenticated, detectRole };
};
