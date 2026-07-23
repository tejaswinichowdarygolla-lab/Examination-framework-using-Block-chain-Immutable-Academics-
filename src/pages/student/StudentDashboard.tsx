import React, { useState, useEffect } from 'react';
import { BookOpen, CheckCircle, Clock, AlertCircle, PlayCircle, MonitorPlay, FileText, Award, TrendingUp, BarChart3, RefreshCw, ShieldCheck, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/context/WalletContext';
import { getExamSchedules, getEncryptedResult, isStudentApproved, getStudentPerformance, getStudentNameByWallet, type ExamSchedule, type StudentResult } from '@/utils/examUtils';
import { mfsReadCSV } from '@/utils/mfs';
import { ipfsCat } from '@/utils/ipfs';
import { EncryptionUtils } from '@/encryption';
import { ResultLedgerContract, toBytes32 } from '@/utils/contractUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

type Tab = 'all' | 'active' | 'previous';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { address } = useWallet();
  const [exams, setExams] = useState<ExamSchedule[]>([]);
  const [results, setResults] = useState<Record<string, StudentResult>>({});
  const [university, setUniversity] = useState('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [activeTab, setActiveTab] = useState<Tab>('all');
  
  // Insights State
  const [insightExam, setInsightExam] = useState<ExamSchedule | null>(null);
  const [performance, setPerformance] = useState<{ option_selected: number | null; correct_option: number }[]>([]);
  const [loadingInsight, setLoadingInsight] = useState(false);

  // Keep clock live
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const isApproved = await isStudentApproved(address).catch(() => false);
      if (!isApproved) {
        navigate('/');
        return;
      }

      const access = await mfsReadCSV('/Access/students.csv');
      if (!access) { setLoading(false); return; }

      const studentRow = access.rows.find(r => r[2]?.toLowerCase() === address.toLowerCase());
      if (!studentRow) { setLoading(false); return; }

      let teacherName = studentRow[3];
      if (teacherName?.startsWith('0x')) {
         const { getTeacherNameByWallet } = await import('@/utils/examUtils');
         const resolved = await getTeacherNameByWallet(teacherName);
         if (resolved) teacherName = resolved;
      }
      
      const uniName = studentRow[5] || studentRow[4] || 'ChainEdu University';
      setUniversity(uniName);

      const schedules = await getExamSchedules(uniName, teacherName).catch(() => []);
      setExams(schedules);

      const resultsMap: Record<string, StudentResult> = {};
      const ledger = ResultLedgerContract();

      for (const sch of schedules) {
        try {
          if (ledger && address) {
             const examHash = toBytes32(sch.examName);
             const latest: any = await ledger.methods.getLatestResult(address, examHash).call();
             
             if (latest && (latest as any).ipfsCID) {
               const payload = await ipfsCat((latest as any).ipfsCID);
               const decrypted = EncryptionUtils.decryptAES(payload);
               resultsMap[sch.examName] = JSON.parse(decrypted);
               continue; 
             }
          }
        } catch (e) {}

        try {
          const res = await getEncryptedResult(uniName, teacherName, sch.examName, address).catch(() => null);
          if (res) resultsMap[sch.examName] = res;
        } catch {}
      }
      setResults(resultsMap);
    } catch (err) {
      console.error("Dashboard load failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewInsights = async (exam: ExamSchedule) => {
    if (!address) return;
    setInsightExam(exam);
    setLoadingInsight(true);
    try {
      const sName = await getStudentNameByWallet(address);
      const perf = await getStudentPerformance(university, exam.teacherName, exam.examName, sName, address);
      setPerformance(perf);
    } catch (err) {
      toast.error("Could not load performance details.");
    } finally {
      setLoadingInsight(false);
    }
  };

  const handleDownloadReport = (examName: string) => {
    const res = results[examName];
    if (!res) return;
    
    const content = `ChainEdu Exam Report\n-------------------\nExam: ${examName}\nStudent: ${res.studentName}\nWallet: ${res.studentWallet}\nScore: ${res.score}/${res.total}\nPercentage: ${res.percentage.toFixed(2)}%\nSubmitted: ${new Date(res.submittedAt).toLocaleString()}\n-------------------\nGenerated via ChainEdu Nexus`.trim();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Report_${examName}.txt`;
    a.click();
    toast.success("Report downloaded.");
  };

  useEffect(() => {
    load();
  }, [address]);

  const getExamStatus = (s: ExamSchedule) => {
    const start = new Date(s.startTime).getTime();
    const end   = new Date(s.endTime).getTime();
    if (now < start) return 'upcoming';
    if (now >= start && now <= end) return 'active';
    return 'previous';
  };

  const filteredExams = exams.filter(exam => {
    const status = getExamStatus(exam);
    if (activeTab === 'all') return true;
    if (activeTab === 'active') return status === 'active';
    if (activeTab === 'previous') return status === 'previous';
    return true;
  });

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', margin: 0 }}>Student Portal</h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>{university} · Assessments</p>
        </div>

        <div className="flex bg-muted/30 p-1 rounded-md border border-border/10">
          {['all', 'active', 'previous'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as Tab)}
              className={`px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab} exams
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 64, textAlign: 'center', background: '#FFFFFF', border: '1px solid #E4E7EC', borderRadius: 8 }}>
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground/30 mb-4" />
          <p style={{ fontSize: 13, color: '#9CA3AF' }}>Synchronizing with Blockchain...</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filteredExams.map((exam, idx) => {
            const status = getExamStatus(exam);
            const result = results[exam.examName];
            const lowerAddr = address?.toLowerCase() || '';
            const localSubmitted = localStorage.getItem(`chainEdu_submitted_${lowerAddr}_${exam.examName}`) === 'true';
            
            // SEC-TC-055: Robust completion check for UI
            const isCompleted = !!result || localSubmitted || (status === 'previous');
            const hasData = !!result;
            
            return (
              <div key={idx} style={{ background: '#FFFFFF', border: '1px solid #E4E7EC', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111827' }}>{exam.examName}</h3>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6B7280' }}>{exam.teacherName}</p>
                  </div>
                  {status === 'active' && !isCompleted && (
                    <span style={{ padding: '2px 8px', borderRadius: 4, background: '#DCFCE7', color: '#15803D', fontSize: 10, fontWeight: 700 }}>LIVE</span>
                  )}
                  {isCompleted && (
                    <span style={{ padding: '2px 8px', borderRadius: 4, background: '#EFF6FF', color: '#2563EB', fontSize: 10, fontWeight: 700 }}>COMPLETED</span>
                  )}
                </div>

                {result ? (
                  <div style={{ background: '#F9FAFB', border: '1px solid #E4E7EC', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' }}>Score</p>
                      <p style={{ fontSize: 20, fontWeight: 900, color: '#111827', margin: 0 }}>{result.score}/{result.total}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' }}>Grade</p>
                      <p style={{ fontSize: 20, fontWeight: 900, color: result.percentage >= 40 ? '#16A34A' : '#DC2626', margin: 0 }}>{result.percentage.toFixed(0)}%</p>
                    </div>
                  </div>
                ) : (
                  <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 16 }}>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Clock size={12} /> Ends: {new Date(exam.endTime).toLocaleString()}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                  {status === 'active' && !isCompleted ? (
                    <Button onClick={() => navigate(`/student/exam/${exam.examName}`)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 shadow-sm">
                      <Monitor className="h-4 w-4 mr-2" /> Start Exam
                    </Button>
                  ) : isCompleted ? (
                    <div className="grid grid-cols-2 gap-2">
                       <Button onClick={() => handleViewInsights(exam)} variant="outline" className="h-9 text-xs font-bold uppercase tracking-tight border-slate-200">
                         <TrendingUp className="h-3 w-3 mr-1.5" /> Insights
                       </Button>
                       <Button onClick={() => handleDownloadReport(exam.examName)} variant="outline" className="h-9 text-xs font-bold uppercase tracking-tight border-slate-200">
                         <BarChart3 className="h-3 w-3 mr-1.5" /> Report
                       </Button>
                    </div>
                  ) : (
                    <Button disabled className="w-full bg-slate-50 text-slate-400 font-bold h-10 border border-slate-100">
                       {status === 'upcoming' ? 'Not Started' : 'Ended'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Insights Modal */}
      <Dialog open={!!insightExam} onOpenChange={(open) => !open && setInsightExam(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
          <div className="p-6 border-b bg-muted/10">
            <h2 className="text-xl font-black uppercase tracking-tight">Performance Audit: {insightExam?.examName}</h2>
            <p className="text-xs text-muted-foreground mt-1">Immutable Decentralized Record · Polygon zkEVM</p>
          </div>
          <div className="p-6 space-y-6">
            {loadingInsight ? (
              <div className="py-20 text-center animate-pulse text-muted-foreground font-medium">Decrypting Session Data...</div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 border rounded-xl">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Total Questions</p>
                    <p className="text-2xl font-black text-slate-900">{performance.length}</p>
                  </div>
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <p className="text-[10px] font-black uppercase text-emerald-600/50 mb-1">Correct Answers</p>
                    <p className="text-2xl font-black text-emerald-700">{performance.filter(p => p.option_selected === p.correct_option).length}</p>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Q#</TableHead>
                      <TableHead>Your Answer</TableHead>
                      <TableHead>Correct Key</TableHead>
                      <TableHead className="text-right">Audit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performance.map((p, i) => {
                      const isCorrect = p.option_selected === p.correct_option;
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-bold text-muted-foreground">#{(i+1).toString().padStart(2,'0')}</TableCell>
                          <TableCell className={isCorrect ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>Option {p.option_selected ?? 'N/A'}</TableCell>
                          <TableCell className="font-bold">Option {p.correct_option}</TableCell>
                          <TableCell className="text-right">{isCorrect ? '✅' : '❌'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
