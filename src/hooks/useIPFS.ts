/**
 * src/hooks/useIPFS.ts
 *
 * React hook that:
 *  1. Checks IPFS connection on mount
 *  2. Initialises /chainedu/ directory scaffold if not already present
 *  3. Provides ready-to-use ipfsStatus to any component
 *
 * Usage:
 *   const { ipfsReady, ipfsError, peerId } = useIPFS();
 */

import { useState, useEffect } from 'react';
import { checkIPFSConnection } from '@/utils/ipfs';
import { initChainEduDirectories } from '@/utils/mfs';

export interface IPFSStatus {
  ipfsReady:    boolean;
  ipfsChecking: boolean;
  ipfsError:    string | null;
  peerId:       string | null;
}

let _initialized = false; // module-level flag — only scaffold once per session

export function useIPFS(): IPFSStatus {
  const [ipfsReady,    setIPFSReady]    = useState(false);
  const [ipfsChecking, setIPFSChecking] = useState(true);
  const [ipfsError,    setIPFSError]    = useState<string | null>(null);
  const [peerId,       setPeerId]       = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setIPFSChecking(true);
      setIPFSError(null);

      // 1. Health check
      const conn = await checkIPFSConnection();
      if (cancelled) return;

      if (!conn.ok) {
        setIPFSError(conn.error ?? 'IPFS connection failed');
        setIPFSReady(false);
        setIPFSChecking(false);
        return;
      }

      setPeerId(conn.peerId ?? null);

      // 2. Scaffold directories (only once per browser session)
      if (!_initialized) {
        const scaffold = await initChainEduDirectories();
        if (!scaffold.ok) {
          console.warn('[useIPFS] Directory scaffold failed:', scaffold.error);
          // Non-fatal — app can still work, MFS writes will use parents:true
        }
        _initialized = true;
      }

      if (!cancelled) {
        setIPFSReady(true);
        setIPFSChecking(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  return { ipfsReady, ipfsChecking, ipfsError, peerId };
}
