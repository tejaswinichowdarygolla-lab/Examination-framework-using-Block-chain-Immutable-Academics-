import { Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';

function truncate(hash: string, start = 6, end = 4) {
  if (hash.length <= start + end + 3) return hash;
  return `${hash.slice(0, start)}...${hash.slice(-end)}`;
}

export function CIDDisplay({ cid, className }: { cid: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(cid); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-sm text-secondary ${className || ''}`}>
      {truncate(cid, 8, 6)}
      <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors" title="Copy CID">
        <Copy className="h-3.5 w-3.5" />
      </button>
      <a href={`https://ipfs.io/ipfs/${cid}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-secondary transition-colors">
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
      {copied && <span className="text-xs text-success">Copied!</span>}
    </span>
  );
}

export function TxHashDisplay({ hash, className }: { hash: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(hash); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-sm text-primary ${className || ''}`}>
      {truncate(hash, 8, 6)}
      <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors" title="Copy hash">
        <Copy className="h-3.5 w-3.5" />
      </button>
      <a href={`https://cardona-zkevm.polygonscan.com/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
      {copied && <span className="text-xs text-success">Copied!</span>}
    </span>
  );
}

export function DIDDisplay({ did, className }: { did: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(did); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-sm ${className || ''}`}>
      {truncate(did, 12, 6)}
      <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors" title="Copy DID">
        <Copy className="h-3.5 w-3.5" />
      </button>
      {copied && <span className="text-xs text-success">Copied!</span>}
    </span>
  );
}
