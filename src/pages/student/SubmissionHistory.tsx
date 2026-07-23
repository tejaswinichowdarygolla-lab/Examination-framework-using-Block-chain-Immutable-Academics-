import React, { useState, useEffect } from 'react';
import { GlassCard } from '@/components/shared/GlassCard';
import { StatusBadge } from '@/components/shared/Badges';
import { TxHashDisplay, CIDDisplay } from '@/components/shared/HashDisplays';
import { useWallet } from '@/context/WalletContext';
import { getVerifiedStudentResults, type VerifiedResult } from '@/utils/verifiedRetrieval';
import { Loader2, ShieldCheck, ShieldAlert, History } from 'lucide-react';

export default function SubmissionHistory() {
  const { address } = useWallet();
  const [submissions, setSubmissions] = useState<VerifiedResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllHistory = async () => {
      if (!address) return;
      try {
        setLoading(true);
        // In a real app we'd fetch the list of examIds the student took.
        // For the submission history view, we'll fetch verified entries from ResultLedger.
        const history = await getVerifiedStudentResults(address, "all"); // Using "all" as a placeholder/custom endpoint for student's data
        setSubmissions(history);
      } catch (err) {
        console.error("[SubmissionHistory] Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllHistory();
  }, [address]);

  return (
    <div className="space-y-6 max-w-6xl animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <History className="text-primary" />
          Academic Record
        </h1>
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <ShieldCheck size={14} className="text-emerald-500" />
          Verified by Polygon zkEVM
        </div>
      </div>

      <GlassCard className="overflow-x-auto !p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground bg-muted/20">
              <th className="px-4 py-3 text-left font-medium">Exam (ID)</th>
              <th className="px-4 py-3 text-left font-medium">Result Hash & CID</th>
              <th className="px-4 py-3 text-left font-medium">Score</th>
              <th className="px-4 py-3 text-left font-medium">Validation Status</th>
              <th className="px-4 py-3 text-left font-medium">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="text-muted-foreground font-medium">Verifying blockchain integrity...</span>
                  </div>
                </td>
              </tr>
            ) : submissions.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-20 text-center text-muted-foreground">
                  No submission records found for this wallet.
                </td>
              </tr>
            ) : (
              submissions.map((sub, idx) => (
                <tr key={`${sub.examId}-${idx}`} className="border-b border-border/50 hover:bg-muted/30 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="font-bold text-foreground">Exam {sub.examId.slice(0, 8)}...</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest">v{sub.version}</div>
                  </td>
                  <td className="px-4 py-3 space-y-1">
                    <CIDDisplay cid={sub.ipfsCID} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono font-bold text-lg">{sub.score}/{sub.totalQuestions}</div>
                    <div className="text-[10px] text-muted-foreground">{Math.round((sub.score/sub.totalQuestions)*100)}% Proficiency</div>
                  </td>
                  <td className="px-4 py-3">
                    {/* SEC-TC-061 & SEC-TC-062: Integrity UI */}
                    {sub.integrityVerified ? (
                      <StatusBadge variant="success" pulse>
                        <ShieldCheck size={12} className="mr-1" />
                        Integrity Verified
                      </StatusBadge>
                    ) : (
                      <StatusBadge variant="destructive" pulse>
                        <ShieldAlert size={12} className="mr-1" />
                        Hash Mismatch (Tampered)
                      </StatusBadge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(sub.timestamp * 1000).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </GlassCard>

      <div className="bg-muted/30 border border-dashed border-border p-4 rounded-lg flex gap-4 items-start">
        <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-semibold">Self-Sovereign Data Protection</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Every entry shown here has been verified against your unique wallet signature and the decentralized hash anchored on the Polygon zkEVM. 
            If the blockchain anchor (Hash) does not match the IPFS content (CID), the result is flagged as invalid.
          </p>
        </div>
      </div>
    </div>
  );
}
