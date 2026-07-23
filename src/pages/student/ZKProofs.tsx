import { GlassCard } from '@/components/shared/GlassCard';
import { StatusBadge } from '@/components/shared/Badges';
import { TxHashDisplay, CIDDisplay } from '@/components/shared/HashDisplays';
import { Button } from '@/components/ui/button';
import { Shield, Download, ExternalLink } from 'lucide-react';
import { mockSubmissions } from '@/utils/mockData';

export default function ZKProofs() {
  const verifiedSubs = mockSubmissions.filter(s => s.zkProofStatus === 'verified');

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">My Cryptographic Receipts</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {verifiedSubs.slice(0, 6).map(sub => (
          <GlassCard key={sub.id} className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{sub.examName}</h3>
                <p className="text-xs text-muted-foreground">{sub.courseName}</p>
              </div>
              <StatusBadge variant="success" pulse>
                <Shield className="h-3 w-3" /> ZK Verified
              </StatusBadge>
            </div>

            <div className="chain-separator" />

            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Tx Hash</span>
                <TxHashDisplay hash={sub.txHash} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">IPFS CID</span>
                <CIDDisplay cid={sub.ipfsCid} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Block</span>
                <span className="font-mono text-xs">{sub.blockNumber.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Submitted</span>
                <span className="text-xs">{new Date(sub.submissionTime).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 text-xs border-primary/30 text-primary">
                <Download className="h-3 w-3 mr-1" /> Receipt
              </Button>
              <Button size="sm" variant="outline" className="flex-1 text-xs border-secondary/30 text-secondary">
                <ExternalLink className="h-3 w-3 mr-1" /> Verify
              </Button>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
