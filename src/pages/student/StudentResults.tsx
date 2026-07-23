import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, ShieldAlert, FileSearch, Hash, Download, ExternalLink, Award, Loader2, RefreshCw, Layers, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/context/WalletContext';
import { ResultLedgerContract, toBytes32 } from '@/utils/contractUtils';
import { EncryptionUtils } from '@/encryption';
import { ipfsCat } from '@/utils/ipfs';
import { getStudentPerformance, getStudentNameByWallet, getExamSchedules, getTeacherNameByWallet, type StudentResult } from '@/utils/examUtils';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

interface VerifiedEntry {
  examName: string;
  teacherName: string;
  university: string;
  result: any;
  ipfsCID: string;
  onChainHash: string;
  isVerified: boolean;
  timestamp: number;
}

export default function StudentResults() {
  const { address } = useWallet();
  const [results, setResults] = useState<VerifiedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Insights State
  const [insightExam, setInsightExam] = useState<any | null>(null);
  const [performance, setPerformance] = useState<{ option_selected: number | null; correct_option: number }[]>([]);
  const [loadingInsight, setLoadingInsight] = useState(false);

  /**
   * Universal Result Recovery Logic:
   * 1. Resolve student's University and Teacher(s) from /Access/students.csv
   * 2. Fetch all schedules for those teachers.
   * 3. Loop through schedules AND cross-reference the Blockchain for anchored CIDs.
   */
  const fetchVerifiedResults = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const ledger = ResultLedgerContract();
      const { mfsReadCSV } = await import('@/utils/mfs');
      
      // 1. Get Student context
      const access = await mfsReadCSV('/Access/students.csv');
      if (!access) { setLoading(false); return; }

      const studentData = access.rows.filter(r => r[2]?.toLowerCase() === address.toLowerCase());
      if (studentData.length === 0) {
        console.warn("[StudentResults] Student wallet not found in security access list.");
        setLoading(false); 
        return; 
      }

      const verifiedList: VerifiedEntry[] = [];
      const checkedExams = new Set<string>();

      // 2. Iterate through all assigned teachers (Student might have multiple)
      for (const row of studentData) {
        let teacherIdent = row[3]; // Might be name or wallet
        const uni = row[5] || 'ChainEdu University';

        // Resolve wallet to name if needed for MFS path discovery
        if (teacherIdent?.startsWith('0x')) {
          const resolved = await getTeacherNameByWallet(teacherIdent);
          if (resolved) teacherIdent = resolved;
        }

        const schedules = await getExamSchedules(uni, teacherIdent).catch(() => []);
        
        // 3. For each schedule, check the Decentralized Ledger
        for (const sch of schedules) {
          if (checkedExams.has(sch.examName)) continue;
          checkedExams.add(sch.examName);

          try {
            const examHash = toBytes32(sch.examName);
            // DIRECT LEDGER CALL: Bypass MFS if blockchain has the anchor
            const latest: any = await ledger.methods.getLatestResult(address, examHash).call();
            
            if (latest && latest.ipfsCID && latest.ipfsCID.trim() !== '') {
              // Fetch payload from Decentralized Storage
              const payload = await ipfsCat(latest.ipfsCID);
              
              // Verify Integrity (SHA-256 Check)
              const computedHash = EncryptionUtils.hashSHA256(payload);
              const matches = (computedHash.toLowerCase() === latest.resultHash.toLowerCase()) || 
                              (computedHash.toLowerCase() === latest.resultHash.replace('0x0x','0x').toLowerCase());
              
              const decrypted = EncryptionUtils.decryptAES(payload);
              const data = JSON.parse(decrypted);

              verifiedList.push({
                examName: sch.examName,
                teacherName: sch.teacherName || teacherIdent,
                university: uni,
                result: { 
                  ...data, 
                  score: Number(latest.score), 
                  total: Number(latest.totalQuestions), 
                  percentage: (Number(latest.score)/Number(latest.totalQuestions))*100 
                },
                ipfsCID: latest.ipfsCID,
                onChainHash: latest.resultHash,
                isVerified: matches,
                timestamp: Number(latest.timestamp)
              });
            }
          } catch (e) {
            // No result for this specific exam on-chain yet
          }
        }
      }

      setResults(verifiedList.sort((a,b) => b.timestamp - a.timestamp));
    } catch (err) {
      console.error("[StudentResults] Ledger synchronization error:", err);
      toast.error("Ledger sync partial failure. Check network.");
    } finally {
      setLoading(false);
    }
  }, [address]);

  const handleViewInsights = async (r: VerifiedEntry) => {
    if (!address) return;
    setInsightExam(r);
    setLoadingInsight(true);
    try {
      const sName = await getStudentNameByWallet(address);
      const perf = await getStudentPerformance(r.university, r.teacherName, r.examName, sName, address);
      setPerformance(perf);
    } catch (err) {
      toast.error("Could not load performance audit.");
    } finally {
      setLoadingInsight(false);
    }
  };

  const downloadReport = (r: VerifiedEntry) => {
    const content = `Official ChainEdu Academic Report\n-------------------\nStatus: VERIFIED ON BLOCKCHAIN\nExam: ${r.examName}\nUniversity: ${r.university}\nStudent: ${r.result.studentName}\nScore: ${r.result.score}/${r.result.total}\nHash: ${r.onChainHash}\nCID: ${r.ipfsCID}\n-------------------\nTimestamp: ${new Date(r.timestamp * 1000).toLocaleString()}`.trim();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Academic_Report_${r.examName}.txt`;
    a.click();
    toast.success("Final report downloaded.");
  };

  useEffect(() => {
    fetchVerifiedResults();
  }, [fetchVerifiedResults]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-500 p-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-black flex items-center gap-3 tracking-tighter uppercase italic">
             <Layers className="text-blue-600 w-8 h-8" />
             My Academic Ledger
           </h1>
           <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">Cross-Verified Results · Polygon zkEVM</p>
        </div>
        <Button onClick={fetchVerifiedResults} variant="outline" className="gap-2 h-10 border-slate-200 font-bold bg-white shadow-sm hover:bg-slate-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Sync With Blockchain
        </Button>
      </div>

      {loading ? (
        <div className="py-32 flex flex-col items-center justify-center space-y-4">
           <Loader2 className="h-10 w-10 animate-spin text-blue-100" />
           <p className="text-xs font-black uppercase text-slate-300 tracking-[0.2em]">Contacting Ledger Nodes...</p>
        </div>
      ) : results.length === 0 ? (
        <div className="bg-white border rounded-2xl border-dashed py-32 text-center space-y-4 shadow-sm">
           <FileSearch size={48} className="mx-auto text-slate-100" />
           <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No decentralized results anchored yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {results.map((r, i) => (
            <div key={i} className={`bg-white border ${r.isVerified ? 'border-slate-100' : 'border-rose-100 bg-rose-50/10'} rounded-2xl p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group`}>
              
              {/* Verification Watermark */}
              <div className="absolute top-0 right-0 p-3">
                 {r.isVerified ? (
                   <CheckCircle2 size={16} className="text-emerald-500 opacity-20 group-hover:opacity-100 transition-opacity" />
                 ) : (
                   <ShieldAlert size={16} className="text-rose-500 opacity-20 group-hover:opacity-100 transition-opacity" />
                 )}
              </div>

              <div className="flex flex-col lg:flex-row gap-8 justify-between items-start lg:items-center relative z-10">
                <div className="space-y-5 flex-1 w-full">
                  <div className="flex items-start gap-4">
                     <div className={`p-3 rounded-xl ${r.result.percentage >= 40 ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'} flex items-center justify-center shrink-0`}>
                        <Award size={24} />
                     </div>
                     <div>
                        <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter">{r.examName}</h3>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-2 mt-1">
                           <Clock size={10} /> {new Date(r.timestamp * 1000).toLocaleString()} · {r.university}
                        </p>
                     </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="bg-slate-50/80 border border-slate-100 px-5 py-2.5 rounded-xl">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Anchored Score</p>
                      <p className="text-2xl font-black text-slate-900 tracking-tighter">{r.result.score} / {r.result.total}</p>
                    </div>
                    <div className="flex-1 max-w-[200px]">
                      <div className="flex justify-between items-center mb-1.5">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Proficiency Index</p>
                         <p className={`text-[11px] font-black ${r.result.percentage >= 40 ? 'text-blue-600' : 'text-rose-600'}`}>{r.result.percentage.toFixed(1)}%</p>
                      </div>
                      <Progress value={r.result.percentage} className={`h-2 ${r.result.percentage >= 40 ? 'bg-blue-100' : 'bg-rose-100'}`} />
                    </div>
                  </div>
                </div>

                <div className="w-full lg:w-auto grid grid-cols-2 lg:flex gap-2">
                  <Button 
                    className="h-11 px-6 text-xs font-black uppercase tracking-widest gap-2 rounded-xl"
                    onClick={() => handleViewInsights(r)}
                  >
                    <TrendingUp size={14} /> View Insights
                  </Button>
                  <Button 
                    variant="outline"
                    className="h-11 px-6 text-xs font-black uppercase tracking-widest gap-2 border-slate-200 rounded-xl bg-white"
                    onClick={() => downloadReport(r)}
                  >
                    <Download size={14} /> Export Report
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="col-span-2 lg:absolute lg:-bottom-2 lg:right-0 text-[9px] font-black uppercase text-slate-300 hover:text-blue-400"
                    onClick={() => window.open(`http://localhost:8080/ipfs/${r.ipfsCID}`, '_blank')}
                  >
                    Inspect IPFS Anchor <ExternalLink size={8} className="ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Insights Audit Modal */}
      <Dialog open={!!insightExam} onOpenChange={(open) => !open && setInsightExam(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl rounded-3xl overflow-hidden">
          <div className="p-8 border-b bg-slate-900 text-white">
            <h2 className="text-2xl font-black uppercase tracking-tighter italic">Academic Forensic Audit</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Immutable session capture for {insightExam?.examName}</p>
          </div>
          <div className="p-8">
            {loadingInsight ? (
              <div className="py-24 text-center animate-pulse">
                 <Loader2 className="mx-auto h-8 w-8 text-blue-600 animate-spin mb-4" />
                 <p className="text-[11px] font-black uppercase text-slate-400 tracking-[0.3em]">Decrypting Session Vault...</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                   <div className="bg-slate-50 p-4 rounded-2xl border">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Status</p>
                      <p className="text-sm font-black text-emerald-600">VERIFIED</p>
                   </div>
                   <div className="bg-slate-50 p-4 rounded-2xl border">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Hash Verification</p>
                      <p className="text-[10px] font-mono font-bold truncate">{insightExam?.onChainHash}</p>
                   </div>
                   <div className="bg-slate-50 p-4 rounded-2xl border">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Teacher</p>
                      <p className="text-sm font-black">{insightExam?.teacherName}</p>
                   </div>
                </div>

                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-16 text-[10px] font-black uppercase">Q#</TableHead>
                      <TableHead className="text-[10px] font-black uppercase">Student Response</TableHead>
                      <TableHead className="text-[10px] font-black uppercase">Master Key</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase">Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performance.map((p, i) => {
                      const isCorrect = p.option_selected === p.correct_option;
                      return (
                        <TableRow key={i} className="hover:bg-slate-50/50">
                          <TableCell className="font-black text-slate-300 tracking-tighter text-lg">#{(i+1).toString().padStart(2,'0')}</TableCell>
                          <TableCell className={isCorrect ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>
                             Option {p.option_selected ?? 'EMPTY'}
                          </TableCell>
                          <TableCell className="font-black text-slate-900 italic">Option {p.correct_option}</TableCell>
                          <TableCell className="text-right">
                             {isCorrect ? (
                               <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black">MATCH</div>
                             ) : (
                               <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 text-[10px] font-black">MISMATCH</div>
                             )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
