import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { GlassCard } from '@/components/shared/GlassCard';
import { StatusBadge } from '@/components/shared/Badges';
import { TxHashDisplay, CIDDisplay, DIDDisplay } from '@/components/shared/HashDisplays';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { mockExams, mockSubmissions } from '@/utils/mockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { useWallet } from '@/context/WalletContext';
import { useWeb3 } from '@/hooks/useWeb3';
import { useContract } from '@/hooks/useContract';
import { getExamResults, type StudentResult } from '@/utils/examUtils';
import { toBytes32 } from '@/utils/contractUtils';
import { useEffect } from 'react';
import { toast } from 'sonner';

export default function InstructorSubmissions() {
  const { examId } = useParams();
  const { address } = useWallet();
  const { web3 } = useWeb3();
  const { getExamManager } = useContract(web3);

  const [exam, setExam] = useState<any>(null);
  const [subs, setSubs] = useState<StudentResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      if (!examId || !address) return;
      try {
        setIsLoading(true);
        const manager = await getExamManager();
        if (!manager) return;

        // SEC-TC-043: Verify Exam Ownership
        const examData = await manager.methods.getExam(toBytes32(examId)).call();
        if (examData.teacher.toLowerCase() !== address.toLowerCase()) {
          setError("ACCESS DENIED: You are not the owner of this exam.");
          return;
        }

        setExam(examData);
        const results = await getExamResults(examId);
        setSubs(results);
      } catch (err: any) {
        setError(err.message || "Failed to load submissions");
      } finally {
        setIsLoading(false);
      }
    }
    init();

    // SEC-TC-067: RBAC Heartbeat (Check for revocation mid-session)
    const heartbeat = setInterval(async () => {
      const { getRoleManager } = await import('@/utils/contractUtils');
      const roleManager = await getRoleManager();
      if (roleManager && address) {
        const isAuthorized = await roleManager.methods.isTeacher(address).call();
        if (!isAuthorized) {
          setError("SESSION REVOKED: You no longer have instructor privileges for this institution.");
        }
      }
    }, 60000); // 1-minute check

    return () => clearInterval(heartbeat);
  }, [examId, address]);

  if (error) return (
    <div className="p-12 text-center bg-destructive/10 border border-destructive/20 rounded-2xl">
      <h2 className="text-destructive font-black text-xl mb-2 italic">SECURITY EXCEPTION</h2>
      <p className="text-muted-foreground">{error}</p>
    </div>
  );

  if (isLoading) return <div className="p-8 text-center animate-pulse">Loading Secured Submissions...</div>;
  if (!exam) return null;

  const gradeData = [
    { range: '90-100', count: 3 }, { range: '80-89', count: 5 },
    { range: '70-79', count: 4 }, { range: '60-69', count: 2 }, { range: '<60', count: 1 },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{exam.name}</h1>
          <p className="text-sm text-muted-foreground">{exam.courseName} · {subs.length} submissions</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge variant="success">Verified: {subs.filter(s => s.zkProofStatus === 'verified').length}</StatusBadge>
          <StatusBadge variant="warning">Pending: {subs.filter(s => s.zkProofStatus === 'pending').length}</StatusBadge>
        </div>
      </div>

      <GlassCard className="overflow-x-auto !p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium">Student DID</th>
              <th className="px-4 py-3 text-left font-medium">Submitted</th>
              <th className="px-4 py-3 text-left font-medium">IPFS CID</th>
              <th className="px-4 py-3 text-left font-medium">ZK Proof</th>
              <th className="px-4 py-3 text-left font-medium">Grade Hash</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subs.map(sub => (
              <tr key={sub.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3"><DIDDisplay did={sub.studentDid} /></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(sub.submissionTime).toLocaleString()}</td>
                <td className="px-4 py-3"><CIDDisplay cid={sub.ipfsCid} /></td>
                <td className="px-4 py-3">
                  <StatusBadge
                    variant={sub.zkProofStatus === 'verified' ? 'success' : sub.zkProofStatus === 'pending' ? 'warning' : 'error'}
                    pulse>
                    {sub.zkProofStatus === 'verified' ? '✅ Verified' : sub.zkProofStatus === 'pending' ? '⏳ Pending' : '❌ Invalid'}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {sub.gradeCommitment.slice(0, 10)}...
                </td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="ghost" className="text-xs text-primary"
                    onClick={() => setSelectedSub(selectedSub === sub.id ? null : sub.id)}>
                    Decrypt
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      {/* Analytics */}
      <div className="grid md:grid-cols-2 gap-6">
        <GlassCard className="space-y-4">
          <h3 className="font-semibold">Grade Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={gradeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 18%)" />
              <XAxis dataKey="range" tick={{ fill: 'hsl(220 9% 46%)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'hsl(220 9% 46%)', fontSize: 12 }} />
              <Tooltip contentStyle={{ background: 'hsl(221 39% 11%)', border: '1px solid hsl(220 20% 18%)', borderRadius: '8px' }} />
              <Bar dataKey="count" fill="hsl(263 83% 58%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="space-y-4">
          <h3 className="font-semibold">Submission Progress</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Submitted</span>
              <span>{exam.submissionCount} / {exam.totalStudents}</span>
            </div>
            <Progress value={(exam.submissionCount / exam.totalStudents) * 100} className="h-3" />
            <p className="text-xs text-muted-foreground">Average grade: 78.4</p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
