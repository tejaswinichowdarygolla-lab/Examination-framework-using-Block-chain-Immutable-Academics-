import { useState, useCallback } from 'react';
import Web3 from 'web3';

export const useWeb3 = () => {
  const [web3Instance, setWeb3Instance] = useState<Web3 | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const eth = (window as any).ethereum;
      if (eth) {
        const accounts = await eth.request({ method: 'eth_requestAccounts' });
        const web3 = new Web3(eth);
        const currentChainId = await eth.request({ method: 'eth_chainId' });
        
        setWeb3Instance(web3);
        setAccount(accounts[0]);
        setChainId(currentChainId);
        
        eth.on('accountsChanged', (newAccounts: string[]) => {
          setAccount(newAccounts[0] || null);
        });
        
        eth.on('chainChanged', (newChainId: string) => {
          setChainId(newChainId);
          window.location.reload();
        });
        
      } else {
        throw new Error('MetaMask not detected');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const getTargetChainId = () => {
    const defaultChainIdHex = '0x539';
    const envChainId = (import.meta.env.VITE_CHAIN_ID) || (import.meta.env.REACT_APP_CHAIN_ID);
    if (!envChainId) return defaultChainIdHex;
    return `0x${Number(envChainId).toString(16)}`;
  };

  const isCorrectNetwork = chainId === getTargetChainId();

  const switchToGanache = useCallback(async () => {
    const eth = (window as any).ethereum;
    if (!eth) return;
    try {
      const targetChainId = getTargetChainId();
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetChainId }],
      });
    } catch {
       setError('Failed to switch network');
    }
  }, []);

  const disconnect = useCallback(() => {
    setWeb3Instance(null);
    setAccount(null);
    setChainId(null);
  }, []);

  return { web3: web3Instance, account, chainId, isCorrectNetwork, isConnecting, error, connectWallet, switchToGanache, disconnect };
};
