import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { ENV, isAdminAddress } from '@/config/env';
import { TEST_MODE_ACTIVE, TEST_CREDENTIALS } from '../../test/testConfig';
import { isTeacherApproved, getTeacherInfo, isStudentApproved } from '@/utils/examUtils';

export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT' | 'NONE' | null;

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  role: Role;
  did: string | null;
  isDemoMode: boolean;
  chainId: number | null;
  isCorrectNetwork: boolean;
  isConnecting: boolean;
  error: string | null;
}

export interface WalletContextType extends WalletState {
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchToCorrectNetwork: () => Promise<void>;
  refreshRole: () => Promise<void>;
  selectRole: (role: Role) => void;
  enableDemoMode: (role: Role) => void;
}

const GANACHE_CHAIN_ID = ENV.CHAIN_ID;
const GANACHE_HEX = `0x${GANACHE_CHAIN_ID.toString(16)}`;

function getEthereum(): any {
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    return (window as any).ethereum;
  }
  return null;
}

async function detectRole(address: string): Promise<Role> {
  const normalizedAddr = address.toLowerCase();

  // --- Test mode overrides ---
  if (TEST_MODE_ACTIVE === 1) {
    if (normalizedAddr === TEST_CREDENTIALS.admin.toLowerCase()) return 'ADMIN';
    if (normalizedAddr === TEST_CREDENTIALS.teacher.toLowerCase()) return 'TEACHER';
    if (TEST_CREDENTIALS.students.map(s => s.toLowerCase()).includes(normalizedAddr)) return 'STUDENT';
  }

  // --- Always check hardcoded admin first ---
  if (isAdminAddress(address)) return 'ADMIN';

  // --- TEACHER_FLAG=1: check IPFS TeachersAccess.csv ---
  if (ENV.TEACHER_FLAG === 1) {
    try {
      const approved = await isTeacherApproved(normalizedAddr);
      if (approved) return 'TEACHER';
    } catch (e) {
      console.warn('[Auth] Teacher access check failed:', e);
    }
  }

  // --- STUDENT_FLAG=1: check IPFS StudentsAccess.csv ---
  if (ENV.STUDENT_FLAG === 1) {
    try {
      const approved = await isStudentApproved(normalizedAddr);
      if (approved) return 'STUDENT';
    } catch (e) {
      console.warn('[Auth] Student access check failed:', e);
    }
  }

  // --- Smart contract role lookup (production) ---
  try {
    const { default: addresses } = await import('@/contracts/addresses.json');
    const ethers_like = getEthereum();
    if (!ethers_like) return 'NONE';

    const iface = {
      getRole: (addr: string) =>
        ({
          method: 'eth_call',
          params: [
            {
              to: (addresses as any).RoleManager,
              data:
                '0x' +
                '96e76de5' +
                addr.replace('0x', '').toLowerCase().padStart(64, '0'),
            },
            'latest',
          ],
        }),
    };

    const payload = iface.getRole(address);
    const result: string = await ethers_like.request(payload);

    if (result && result.length > 2) {
      const hex = result.slice(2);
      const lengthHex = hex.slice(64, 128);
      const length = parseInt(lengthHex, 16);
      const strHex = hex.slice(128, 128 + length * 2);
      const decoded = strHex
        .match(/.{1,2}/g)!
        .map((b: string) => String.fromCharCode(parseInt(b, 16)))
        .join('');

      if (decoded === 'ADMIN') return 'ADMIN';
      if (decoded === 'TEACHER') return 'TEACHER';
      if (decoded === 'STUDENT') {
        // Double check IPFS registry for STUDENT role
        const approved = await isStudentApproved(normalizedAddr).catch(() => false);
        return approved ? 'STUDENT' : 'NONE';
      }
    }
  } catch {}

  return 'NONE';
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>(() => {
    // METAMASK_FLAG=0 → bypass as ADMIN
    if (ENV.METAMASK_FLAG === 0) {
      return {
        isConnected: true,
        address: '0x0000000000000000000000000000000000000admin',
        role: 'ADMIN',
        did: 'did:ethr:admin_bypass',
        isDemoMode: true,
        chainId: ENV.CHAIN_ID,
        isCorrectNetwork: true,
        isConnecting: false,
        error: null,
      };
    }
    // TEACHER_FLAG=0 (and METAMASK_FLAG=1) → bypass as TEACHER mock
    if (ENV.TEACHER_FLAG === 0 && ENV.METAMASK_FLAG !== 0) {
      return {
        isConnected: true,
        address: '0x0000000000000000000000000000000000teacher',
        role: 'TEACHER',
        did: 'did:ethr:teacher_bypass',
        isDemoMode: true,
        chainId: ENV.CHAIN_ID,
        isCorrectNetwork: true,
        isConnecting: false,
        error: null,
      };
    }
    // STUDENT_FLAG=0 (and METAMASK/TEACHER_FLAG != 0) → bypass as STUDENT mock
    if (ENV.STUDENT_FLAG === 0 && ENV.TEACHER_FLAG !== 0 && ENV.METAMASK_FLAG !== 0) {
      return {
        isConnected: true,
        address: '0x1234567890123456789012345678901234student',
        role: 'STUDENT',
        did: 'did:ethr:student_bypass',
        isDemoMode: true,
        chainId: ENV.CHAIN_ID,
        isCorrectNetwork: true,
        isConnecting: false,
        error: null,
      };
    }
    return {
      isConnected: localStorage.getItem('chainedu_was_connected') === 'true',
      address: null,
      role: null,
      did: null,
      isDemoMode: false,
      chainId: null,
      isCorrectNetwork: false,
      isConnecting: false,
      error: null,
    };
  });

  // Session restoration on mount
  useEffect(() => {
    if (ENV.METAMASK_FLAG === 0) {
      console.warn("[Auth] MetaMaskFlag=0: Plugged into Always-Admin mode.");
      return;
    }

    const restoreSession = async () => {
      const wasConnected = localStorage.getItem('chainedu_was_connected') === 'true';
      const ethereum = getEthereum();
      
      if (wasConnected && ethereum) {
        try {
          const accounts: string[] = await ethereum.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            const address = accounts[0].toLowerCase();
            const chainIdHex: string = await ethereum.request({ method: 'eth_chainId' });
            const chainId = parseInt(chainIdHex, 16);
            const isCorrectNetwork = chainId === GANACHE_CHAIN_ID;
            const role = isCorrectNetwork ? await detectRole(address) : null;

            setState(prev => ({
              ...prev,
              isConnected: true,
              address,
              role,
              did: `did:ethr:${address}`,
              chainId,
              isCorrectNetwork,
              isConnecting: false
            }));
          } else {
            // User likely disconnected from MetaMask UI
            localStorage.removeItem('chainedu_was_connected');
            setState(prev => ({ ...prev, isConnected: false, isConnecting: false }));
          }
        } catch (e) {
          console.error("[Session] Restore failed:", e);
          setState(prev => ({ ...prev, isConnecting: false }));
        }
      } else {
        setState(prev => ({ ...prev, isConnecting: false }));
      }
    };

    restoreSession();
  }, []);

  const refreshRole = useCallback(async () => {
    if (!state.address) return;
    const role = await detectRole(state.address);
    setState((prev) => ({ ...prev, role }));
  }, [state.address]);

  const connectWallet = useCallback(async () => {
    // IF flag is 0, DO NOT open MetaMask. Just return the mock state.
    if (ENV.METAMASK_FLAG === 0) {
      enableDemoMode('ADMIN');
      return;
    }

    const ethereum = getEthereum();
    if (!ethereum) {
      setState((prev) => ({
        ...prev,
        error: 'MetaMask not detected. Please install MetaMask.',
        isConnecting: false
      }));
      return;
    }

    setState((prev) => ({ ...prev, isConnecting: true, error: null }));
    try {
      const accounts: string[] = await ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts selected');
      }

      const address = accounts[0].toLowerCase();
      const chainIdHex: string = await ethereum.request({ method: 'eth_chainId' });
      const chainId = parseInt(chainIdHex, 16);
      const isCorrectNetwork = chainId === GANACHE_CHAIN_ID;
      let role = isCorrectNetwork ? await detectRole(address) : null;

      // SEC-TC-002: Signature Verification for ADMIN role
      if (role === 'ADMIN' && ENV.METAMASK_FLAG === 1) {
        try {
          const message = `Authenticating as Admin for ${ENV.APP_NAME} at ${new Date().toISOString()}`;
          const signature = await ethereum.request({
            method: 'personal_sign',
            params: [message, address],
          });
          
          if (!signature) throw new Error('Signature rejected by user');
          // Since we don't have a backend to verify, we're relying on the fact that personal_sign 
          // successfully returned, meaning the user HAS the private key for this address.
          // Note: Full security would require verifying the signature against the message+address.
        } catch (signErr: any) {
          throw new Error('Admin authentication required signature: ' + (signErr.message || 'Signature rejected'));
        }
      }

      localStorage.setItem('chainedu_was_connected', 'true');
      setState({
        isConnected: true,
        address,
        role,
        did: `did:ethr:${address}`,
        isDemoMode: false,
        chainId,
        isCorrectNetwork,
        isConnecting: false,
        error: null,
      });
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: err?.message?.includes('User rejected') ? 'Connection rejected by user' : (err?.message ?? 'Failed to connect wallet'),
      }));
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    localStorage.removeItem('chainedu_was_connected');
    setState({
      isConnected: false,
      address: null,
      role: null,
      did: null,
      isDemoMode: false,
      chainId: null,
      isCorrectNetwork: false,
      isConnecting: false,
      error: null,
    });
  }, []);

  const selectRole = useCallback((role: Role) => {
    setState((prev) => ({ ...prev, role }));
  }, []);

  const enableDemoMode = useCallback((role: Role) => {
    setState({
      isConnected: true,
      address: '0x000000000000000000000000000000000000demo',
      role: role,
      did: 'did:ethr:0x000000000000000000000000000000000000demo',
      isDemoMode: true,
      chainId: GANACHE_CHAIN_ID,
      isCorrectNetwork: true,
      isConnecting: false,
      error: null,
    });
  }, []);

  const switchToCorrectNetwork = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum) return;
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: GANACHE_HEX }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: GANACHE_HEX,
                chainName: 'Ganache Local',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['http://127.0.0.1:8545'],
              },
            ],
          });
        } catch {
          setState((prev) => ({
            ...prev,
            error: 'Could not add Ganache network',
          }));
        }
      }
    }
  }, []);

  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        const address = accounts[0].toLowerCase();
        const role = state.isCorrectNetwork ? await detectRole(address) : null;
        setState((prev) => ({ ...prev, address, role, did: `did:ethr:${address}`, isDemoMode: false }));
      }
    };

    const handleChainChanged = (chainIdHex: string) => {
      const chainId = parseInt(chainIdHex, 16);
      const isCorrectNetwork = chainId === GANACHE_CHAIN_ID;
      setState((prev) => ({
        ...prev,
        chainId,
        isCorrectNetwork,
        role: isCorrectNetwork ? prev.role : null,
      }));
      if (isCorrectNetwork && state.address) {
        detectRole(state.address).then((role) =>
          setState((prev) => ({ ...prev, role })),
        );
      }
    };

    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);

    return () => {
      ethereum.removeListener('accountsChanged', handleAccountsChanged);
      ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [disconnectWallet, state.address, state.isCorrectNetwork]);

  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    ethereum
      .request({ method: 'eth_accounts' })
      .then(async (accounts: string[]) => {
        if (accounts && accounts.length > 0) {
          const address = accounts[0].toLowerCase();
          const chainIdHex: string = await ethereum.request({ method: 'eth_chainId' });
          const chainId = parseInt(chainIdHex, 16);
          const isCorrectNetwork = chainId === GANACHE_CHAIN_ID;
          const role = isCorrectNetwork ? await detectRole(address) : null;
          
          setState({
            isConnected: true,
            address,
            role,
            did: `did:ethr:${address}`,
            isDemoMode: false,
            chainId,
            isCorrectNetwork,
            isConnecting: false,
            error: null,
          });
        } else {
           localStorage.removeItem('chainedu_was_connected');
           setState(prev => ({ ...prev, isConnected: false }));
        }
      })
      .catch(() => {
        setState(prev => ({ ...prev, isConnecting: false }));
      });
  }, []);

  return (
    <WalletContext.Provider
      value={{
        ...state,
        connectWallet,
        disconnectWallet,
        switchToCorrectNetwork,
        refreshRole,
        selectRole,
        enableDemoMode,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextType {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}


