function required(key: string): string {
  const val = import.meta.env[key];
  if (!val) throw new Error(`Missing required env variable: ${key}`);
  return val as string;
}

export const ENV = {
  // SEC-TC-001: Admin wallet removed from client-exposed bundle to prevent leakage.
  // Use on-chain RoleManager for admin verification.
  IPFS_API: (() => {
    // Check for IPFS API URL override in environment
    const raw = import.meta.env.REACT_APP_IPFS_API_URL as string;
    
    if (typeof window !== 'undefined') {
      // If we are on a network IP (192.168.x.x) or localhost
      // we must use the Vite proxy to avoid CORS 403 Forbidden errors
      if (raw && raw.startsWith('/')) {
        return window.location.origin + raw;
      }
      
      const isLocal = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');
      const isPrivateIP = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(window.location.hostname);
      
      if (!isLocal || isPrivateIP) {
         return window.location.origin + '/ipfs-api';
      }
    }
    return raw || 'http://127.0.0.1:5001';
  })(),
  IPFS_GATEWAY: (import.meta.env.REACT_APP_IPFS_GATEWAY as string) ?? 'http://127.0.0.1:8082',
  CONTRACT_ADDRESS: (import.meta.env.REACT_APP_CONTRACT_ADDRESS as string) ?? '',
  CHAIN_ID: Number(import.meta.env.VITE_CHAIN_ID ?? 1337),
  AES_SALT: (import.meta.env.VITE_AES_SALT as string) ?? 'chainedu-v1-salt-2025',
  APP_NAME: (import.meta.env.VITE_APP_NAME as string) ?? 'ChainEdu',
  APP_URL:  (import.meta.env.VITE_APP_URL as string)  ?? 'http://localhost:8081',
  METAMASK_FLAG: Number(import.meta.env.VITE_METAMASK_FLAG ?? 1),
  TEACHER_FLAG: Number(import.meta.env.VITE_TEACHER_FLAG ?? 1),
  STUDENT_FLAG: Number(import.meta.env.VITE_STUDENT_FLAG ?? 1),
} as const;

export function isAdminAddress(address: string): boolean {
  // SEC-TC-001: No longer hardcoded in client to prevent public key enumeration.
  return false; 
}
