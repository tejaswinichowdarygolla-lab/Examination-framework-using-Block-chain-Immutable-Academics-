/**
 * InstructorDashboard.tsx
 * Complete teacher control centre with 4 sections:
 *   1. Registry  — Generate student links, view/approve students
 *   2. Papers    — Upload question papers, update answer keys
 *   3. Scheduler — Schedule exams, control (stop/pause) during exam
 *   4. Results   — View per-exam student results
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import {
  Users, FileText, Calendar, Plus, Link as LinkIcon,
  Download, Upload, Check, X, Play, Pause, Trash2,
  Edit3, Clock, GraduationCap, ShieldCheck, ChevronRight,
  RefreshCw, Square, AlertCircle, Award, BookOpen,
} from 'lucide-react';
import { GlassCard } from '@/components/shared/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useWallet } from '@/context/WalletContext';
import {
  listQuestionPapers, storeQuestionPaper, updateAnswerKey,
  getTeacherStudents, grantStudentAccess, scheduleExam, getExamSchedules,
  deleteExamSchedule, getExamResults, stopExam, pauseStudentExam,
  resumeStudentExam, isExamActiveNow, canUpdateBeforeExam,
  downloadTemplate, parseCSVText, readFileAsText,
  getPendingTeacherStudents, getTeacherNameByWallet, revokeStudentAccess, teacherStudentsPath,
  type Question, type AnswerKeyRow, type ExamSchedule, type StudentResult,
} from '@/utils/examUtils';
import { generateRegistrationLink } from '@/utils/registrationLinks';
import { getTeacherInfo, getEncryptedResult, storeResultEncrypted } from '@/utils/examUtils';
import { EncryptionUtils } from '@/encryption';
import { ResultLedgerContract, toBytes32 } from '@/utils/contractUtils';
import { ipfsAdd, ipfsCat } from '@/utils/ipfs';

// ── Types ────────────────────────────────────────────────────────────────────

type Section = 'registry' | 'papers' | 'scheduler' | 'results';

// ── Utility ───────────────────────────────────────────────────────────────────

function fmtDuration(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function ExamStatusBadge({ schedule }: { schedule: ExamSchedule }) {
  const now = Date.now();
  const start = new Date(schedule.startTime).getTime();
  const end = new Date(schedule.endTime).getTime();
  if (now < start) {
    const diff = fmtDuration(start - now);
    return <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-black border bg-info/10 border-info/20 text-info uppercase">STARTS IN {diff}</span>;
  }
  if (now >= start && now <= end) {
    return <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-black border bg-success/10 border-success/20 text-success animate-pulse uppercase">● LIVE</span>;
  }
  return <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-black border bg-muted/50 border-border text-muted-foreground uppercase">ENDED</span>;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function InstructorDashboard() {
  const { address } = useWallet();
  const { toast } = useToast();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const section = (searchParams.get('s') as Section) || 'registry';
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSetSection = (s: Section) => {
    setSearchParams({ s });
  };

  // Profile (resolved from IPFS TeachersAccess or bypass default)
  const [teacherName, setTeacherName] = useState('Dr. Alice Johnson');
  const [university, setUniversity]   = useState('ChainEdu University');
  const [department, setDepartment]   = useState('Computer Science');
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Registry
  const [students, setStudents] = useState<{ name: string; walletAddress: string; teacherName: string }[]>([]);
  const [approvedStudents, setApprovedStudents] = useState<{ name: string; walletAddress: string; teacherName: string }[]>([]);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [recentLink, setRecentLink] = useState<string | null>(null);
  const [approvingWallet, setApprovingWallet] = useState<string | null>(null);
  const [rejectingWallet, setRejectingWallet] = useState<string | null>(null);
  const [revokingWallet, setRevokingWallet] = useState<string | null>(null);

  // Papers
  const [papers, setPapers] = useState<string[]>([]);
  const [examLabel, setExamLabel] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadingPaper, setUploadingPaper] = useState(false);
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null);
  const [selectedPaperForKey, setSelectedPaperForKey] = useState<string>('');
  const [updatingKey, setUpdatingKey] = useState(false);

  // Scheduler
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [schedExam, setSchedExam] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [pauseTarget, setPauseTarget] = useState('');  // wallet to pause
  const [pauseExamId, setPauseExamId] = useState('');
  const [now, setNow] = useState(Date.now());

  // Results
  const [resultsExam, setResultsExam] = useState('');
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);

  const fetchStudents = useCallback(async () => {
    if (!address) return;
    const [pending, approved] = await Promise.all([
      getPendingTeacherStudents(address).catch(() => []),
      getTeacherStudents(teacherName).catch(() => [])
    ]);
    setStudents(pending);
    setApprovedStudents(approved);
  }, [address, teacherName]);

  const fetchPapers = useCallback(async () => {
    const list = await listQuestionPapers(university, teacherName).catch(() => []);
    setPapers(list);
  }, [university, teacherName]);

  const fetchSchedules = useCallback(async () => {
    const list = await getExamSchedules(university, teacherName).catch(() => []);
    setSchedules(list);
  }, [university, teacherName]);

  const fetchResults = useCallback(async (examId: string) => {
    if (!examId) return;
    setLoadingResults(true);
    const list = await getExamResults(examId).catch(() => []);
    setResults(list);
    setLoadingResults(false);
  }, []);

  // Refresh clock every 30s to update live status badges
  useEffect(() => {
    clockRef.current = setInterval(() => setNow(Date.now()), 30_000);
    return () => { if (clockRef.current) clearInterval(clockRef.current); };
  }, []);

  // Load teacher profile from IPFS on mount
  useEffect(() => {
    if (!address || profileLoaded) return;
    getTeacherInfo(address)
      .then(info => {
        if (info) {
          setTeacherName(info.name);
          setUniversity(info.university);
          setDepartment(info.department);
        }
        setProfileLoaded(true);
      })
      .catch(() => setProfileLoaded(true));
  }, [address, profileLoaded]);

  // Fetch students & papers when profile is ready
  useEffect(() => {
    if (!profileLoaded) return;
    fetchStudents();
    fetchPapers();
    fetchSchedules();
  }, [profileLoaded, teacherName, university, fetchStudents, fetchPapers, fetchSchedules]);

  // ── Registry Actions ───────────────────────────────────────────────────────

  const handleGenerateLink = async () => {
    setGeneratingLink(true);
    try {
      const { url } = await generateRegistrationLink('Student', address || 'ADMIN', university, department);
      setRecentLink(url);
      navigator.clipboard.writeText(url).catch(() => {});
      toast({ title: 'Link Generated', description: 'Copied to clipboard. Share with students.' });
    } catch {
      toast({ title: 'Failed', description: 'Could not generate link.', variant: 'destructive' });
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleApproveStudent = async (student: { name: string; walletAddress: string; teacherName: string }) => {
    setApprovingWallet(student.walletAddress);
    try {
      const { approveUser } = await import('@/utils/registrationLinks');
      
      // 1. Add to /Registrations/{TeacherName}_Students.csv
      const { mfsAppendCSVRow } = await import('@/utils/mfs');
      // 2. Update the global status to 'approved' in Submissions.csv
      const fullList = await (await import('@/utils/mfs')).mfsReadCSV('/Registrations/Submissions.csv');
      const submissionRecord = fullList?.rows.find(r => r[5].toLowerCase() === student.walletAddress.toLowerCase() && r[7] === 'pending');
      
      if (submissionRecord) {
        // 1. Grant Security Access (to /Access/students.csv)
        await grantStudentAccess(submissionRecord);
        // 2. Approve in Link Manager (Submissions.csv)
        await approveUser(submissionRecord[0], 'approved');
        // 3. Mark approved in Teacher's Registry
        await approveStudentInRegistry(teacherName, student.walletAddress);
      }
      
      await fetchStudents(); 
      toast({ title: 'Access Granted', description: `${student.name} added to security registry.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Could not update access list.', variant: 'destructive' });
    } finally {
      setApprovingWallet(null);
    }
  };

  const handleRejectStudent = async (student: { name: string; walletAddress: string }) => {
    setRejectingWallet(student.walletAddress);
    try {
      const { approveUser } = await import('@/utils/registrationLinks');
      const fullList = await (await import('@/utils/mfs')).mfsReadCSV('/Registrations/Submissions.csv');
      const submissionRecord = fullList?.rows.find(r => r[5].toLowerCase() === student.walletAddress.toLowerCase() && r[7] === 'pending');
      
      if (submissionRecord) {
        await approveUser(submissionRecord[0], 'rejected');
        toast({ title: 'Application Rejected', description: `Student ${student.name} was rejected.` });
      }
      await fetchStudents();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setRejectingWallet(null);
    }
  };

  const handleRevokeAccess = async (student: { name: string; walletAddress: string }) => {
    setRevokingWallet(student.walletAddress);
    try {
      await revokeStudentAccess(student.walletAddress);
      
      // Also remove from teacher's specific CSV to keep the view clean
      const { mfsReadCSV, mfsWriteCSV } = await import('@/utils/mfs');
      const path = teacherStudentsPath(teacherName);
      const data = await mfsReadCSV(path);
      if (data) {
        const updated = data.rows.filter(r => r[1].toLowerCase() !== student.walletAddress.toLowerCase());
        await mfsWriteCSV(path, ['student_name', 'wallet_address', 'teacher_name'], updated);
      }

      await fetchStudents();
      toast({ title: 'Access Revoked', description: `Permissions for ${student.name} have been withdrawn.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setRevokingWallet(null);
    }
  };

  // ── Paper Actions ──────────────────────────────────────────────────────────

  const handlePaperUpload = async () => {
    if (!examLabel.trim()) return toast({ title: 'Name required', description: 'Enter an exam name first.' });
    if (!uploadFile)       return toast({ title: 'File required', description: 'Select a valid .csv file.' });

    if (!uploadFile.name.endsWith('.csv')) {
      return toast({ 
        title: 'Invalid Format', 
        description: 'You uploaded an Excel (.xlsx) file! Please "Save As" a CSV (Comma delimited) file in Excel and upload the .csv file instead.', 
        variant: 'destructive' 
      });
    }

    setUploadingPaper(true);
    try {
      const text = await readFileAsText(uploadFile);
      const rows = parseCSVText(text);
      if (rows.length < 2) throw new Error('File has no data rows or missing headers.');
      
      const headers = rows[0].map(h => h.trim().toLowerCase());
      const dataRows = rows.slice(1);
      
      const parsed: any[] = dataRows.map(row => {
        const obj: any = {};
        headers.forEach((h, i) => {
          obj[h] = row[i];
        });
        return obj;
      });

      // Validate required columns
      const requiredCols = ['question', 'option1', 'option2', 'option3', 'option4', 'answeroption', 'marks'];
      const missing = requiredCols.filter(c => !headers.includes(c));
      
      if (missing.length) {
        throw new Error(`Missing required columns: ${missing.join(', ')} (Found: ${headers.join(', ')})`);
      }

      await storeQuestionPaper(university, teacherName, examLabel.trim(), parsed);
      
      toast({ 
        title: 'Upload Successful', 
        description: `IPFS Paper stored. Found ${parsed.length} questions. Example Q1: "${parsed[0].question.substring(0, 40)}${parsed[0].question.length > 40 ? '...' : ''}"` 
      });

      await fetchPapers();
      setExamLabel('');
      setUploadFile(null);
      (document.getElementById('paper-input') as HTMLInputElement).value = '';
      addNotification("Question Paper Stored", `Exam "${examLabel}" has been compressed and anchored to IPFS.`, 'INSTRUCTOR', 'SUCCESS');
      toast({ title: 'Paper Stored', description: `"${examLabel}" compressed & anchored on IPFS.` });
    } catch (err: any) {
      toast({ title: 'Upload Failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingPaper(false);
    }
  };

  const handleKeyUpdate = async () => {
    const { role } = useWallet();
    if (!address || role !== 'TEACHER') {
      return toast({ title: 'Unauthorized', description: 'Only an approved instructor can anchor result updates.', variant: 'destructive' });
    }
    if (!selectedPaperForKey) return toast({ title: 'Select a paper', description: 'Choose which paper to update.' });
    if (!answerKeyFile) return toast({ title: 'File required', description: 'Select the answer key CSV.' });

    setUpdatingKey(true);
    try {
      // Check if exam is live and block
      const sch = schedules.find(s => s.examName === selectedPaperForKey);
      if (sch && !canUpdateBeforeExam(sch)) {
        throw new Error('Cannot update answer key within 2 minutes of exam start.');
      }

      const text = await readFileAsText(answerKeyFile);
      const rows = parseCSVText(text);
      if (rows.length < 2) throw new Error('Answer key file is empty or missing headers.');
      
      const headers = rows[0].map(h => h.trim().toLowerCase());
      const dataRows = rows.slice(1);

      if (!headers.includes('question_no') || !headers.includes('answer')) {
        throw new Error('Answer key must have columns: question_no, answer');
      }

      const answers: AnswerKeyRow[] = dataRows.map(row => {
        const obj: any = {};
        headers.forEach((h, i) => obj[h] = row[i]);
        return {
          question_no: Number(obj.question_no),
          answer: Number(obj.answer),
        };
      });
      await updateAnswerKey(university, teacherName, selectedPaperForKey, answers);
      
      // --- Part 3: Recursive Result Recalculation & Blockchain Linking ---
      const { safeName, getQuestionPaper } = await import('@/utils/examUtils');
      toast({ title: 'Recalculating Scores', description: 'Applying new key to all student submissions...' });
      
      const allStudentsResults = await getExamResults(selectedPaperForKey);
      const questionPaper = await getQuestionPaper(university, teacherName, selectedPaperForKey);
      const ledger = ResultLedgerContract();
      const examIdHash = toBytes32(selectedPaperForKey);
      
      if (!questionPaper) throw new Error("Could not find question paper to recalculate scores.");

      let successCount = 0;
      let failCount = 0;

      for (const studentRes of allStudentsResults) {
        try {
          // 1. Fetch Performance Choices (Encrypted)
          const shortWallet = studentRes.studentWallet.slice(2, 8).toLowerCase();
          const pUni = safeName(university);
          const pTeacher = safeName(teacherName);
          const pExam = safeName(selectedPaperForKey);
          const pStudent = safeName(studentRes.studentName);
          
          const perfPath = `/Performance/${pUni}/${pTeacher}/${pExam}/${pStudent}${shortWallet}.enc`;
          
          const { mfsReadJSON } = await import('@/utils/mfs');
          const perfPayload = await mfsReadJSON<any>(perfPath);
          if (!perfPayload || !perfPayload.data) continue;

          // 2. Decrypt choices
          const decryptedPerf: any = EncryptionUtils.decryptAES(perfPayload.data);
          const rowsString: string = typeof decryptedPerf === 'object' ? decryptedPerf.data || '' : decryptedPerf;
          const choicesRows = rowsString.split('\n').filter(r => r.includes(',')).slice(1);
          const studentChoices = choicesRows.map((r: string) => r.split(',')[0]);

          // 3. Recalculate score against the NEW key (answers array)
          let totalScoreInt = 0;
          let maxScoreInt = 0;
          
          studentChoices.forEach((choice: any, idx: number) => {
             const q = questionPaper[idx];
             if (!q) return;
             
             const markInt = Math.round((q.marks ?? 1) * 100);
             const negMarkInt = Math.round((q.negative_marks ?? 0) * 100);
             maxScoreInt += markInt;

             const keyEntry = answers.find(a => a.question_no === idx + 1);
             if (keyEntry && Number(choice) === keyEntry.answer) {
                totalScoreInt += markInt;
             } else if (choice !== null && choice !== '') {
                totalScoreInt -= negMarkInt;
             }
          });

          const finalScoreRaw = Math.max(0, totalScoreInt / 100);
          const finalMax = maxScoreInt / 100;
          const percentage = finalMax > 0 ? (finalScoreRaw / finalMax) * 100 : 0;
          
          const updatedResult: StudentResult = {
            ...studentRes,
            score: finalScoreRaw,
            total: finalMax,
            percentage,
            submittedAt: new Date().toISOString()
          };

          const encryptedStr = EncryptionUtils.encryptAES(updatedResult);
          const newCID = await ipfsAdd(encryptedStr);
          const newHash = EncryptionUtils.hashSHA256(encryptedStr);

          // 4. Anchor to Blockchain
          if (ledger && address) {
            console.log(`[Blockchain] Teacher ${address} anchoring updated score for ${studentRes.studentWallet}: ${finalScoreRaw}`);
            
            // ENSURE INTEGER for contract uint256
            const integerScore = Math.floor(finalScoreRaw);
            const integerTotal = Math.floor(finalMax);

            await ledger.methods.submitResult(
              studentRes.studentWallet,
              examIdHash,
              newHash,
              newCID,
              integerScore, 
              integerTotal
            ).send({ 
              from: address,
              gas: 300000 // Explicit gas limit for batch safety
            });
            successCount++;
          }
          
          // Small delay to allow MetaMask to process next request in loop
          await new Promise(r => setTimeout(r, 100));

        } catch (e: any) {
          console.error(`Failed to update student ${studentRes.studentWallet}:`, e);
          failCount++;
          if (e.message?.includes('User rejected') || e.code === 4001) {
            toast({ title: 'Batch Aborted', description: 'Transaction rejected by user.', variant: 'destructive' });
            break;
          }
        }
      }

      setAnswerKeyFile(null);
      (document.getElementById('key-input') as HTMLInputElement).value = '';
      
      if (successCount > 0) {
        addNotification("Audit Trail Updated", `${successCount} student results for "${selectedPaperForKey}" were recalculated and re-anchored.`, 'INSTRUCTOR', 'SUCCESS');
        toast({ title: 'Batch Linkage Complete', description: `${successCount} results updated. ${failCount} failures.` });
      } else if (failCount > 0) {
        toast({ title: 'Update Failed', description: 'No results were updated on blockchain.', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Update Failed', description: err.message, variant: 'destructive' });
    } finally {
      setUpdatingKey(false);
    }
  };

  // ── Scheduler Actions ──────────────────────────────────────────────────────

  const handleSchedule = async () => {
    if (!schedExam || !startTime || !endTime) {
      return toast({ title: 'Incomplete', description: 'Fill all schedule fields.' });
    }
    const start = new Date(startTime).getTime();
    const end   = new Date(endTime).getTime();
    if (start >= end)         return toast({ title: 'Invalid window', description: 'End must be after start.', variant: 'destructive' });
    if (start - Date.now() < 2 * 60 * 1000)
      return toast({ title: 'Too soon', description: 'Schedule at least 2 minutes ahead.', variant: 'destructive' });

    setSavingSchedule(true);
    try {
      // If we are updating an existing entry with the same name, we should clean it first
      // The current scheduleExam just appends. Let's fix handleSchedule to behave as UPSERT
      await deleteExamSchedule(university, teacherName, schedExam).catch(() => {});
      
      await scheduleExam(university, { teacherName, examName: schedExam, startTime, endTime });
      await fetchSchedules();
      setSchedExam(''); setStartTime(''); setEndTime('');
      toast({ title: 'Success', description: `Schedule for "${schedExam}" anchored in IPFS.` });
    } catch (err: any) {
      toast({ title: 'Scheduling Failed', description: err.message, variant: 'destructive' });
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleEditSchedule = (s: ExamSchedule) => {
    setSchedExam(s.examName);
    setStartTime(s.startTime);
    setEndTime(s.endTime);
    // Scroll to top of scheduler form
    window.scrollTo({ top: 300, behavior: 'smooth' });
    toast({ title: 'Editing Schedule', description: `Modifying "${s.examName}". Update the times and Broadcast again.` });
  };

  const handleStopExam = async (examName: string) => {
    try {
      await stopExam(examName, teacherName);
      toast({ title: 'Exam Stopped', description: `"${examName}" has been terminated.` });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handlePauseStudent = async () => {
    if (!pauseTarget || !pauseExamId) return;
    try {
      await pauseStudentExam(pauseExamId, pauseTarget, teacherName);
      toast({ title: 'Student Paused', description: `${pauseTarget} will see a pause message.` });
      setPauseTarget('');
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleResumeStudent = async (examId: string, wallet: string) => {
    try {
      await resumeStudentExam(examId, wallet, teacherName);
      toast({ title: 'Resumed', description: `${wallet} can continue.` });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleDeleteSchedule = async (examName: string) => {
    try {
      await deleteExamSchedule(university, teacherName, examName);
      await fetchSchedules();
      toast({ title: 'Removed', description: `Schedule for "${examName}" deleted.` });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  // ── Tab Header ────────────────────────────────────────────────────────────

  const tabs: { id: Section; label: string; Icon: any }[] = [
    { id: 'registry',  label: 'Registry',   Icon: Users },
    { id: 'papers',    label: 'Exam Papers', Icon: FileText },
    { id: 'scheduler', label: 'Scheduler',   Icon: Calendar },
    { id: 'results',   label: 'Results',     Icon: Award },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px' }}>

      {/* Page Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', margin: '0 0 4px', lineHeight: 1.3 }}>Instructor Dashboard</h1>
          <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>{teacherName} · {university} · {department}</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-muted/30 p-1 rounded-md border border-border/10 self-start md:self-auto">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => handleSetSection(id)}
              className={`flex items-center gap-1.5 h-8 px-3 rounded text-[10px] font-black uppercase tracking-widest transition-colors ${
                section === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3 w-3" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1 – REGISTRY
      ══════════════════════════════════════════════════════════════════════ */}
      {section === 'registry' && (
        <div className="space-y-6">
          {/* Generate Link card */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E7EC', borderRadius: 8, padding: 24, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 8px' }}>
                    <LinkIcon style={{ width: 14, height: 14, color: '#2563EB' }} /> Generate Student Link
                  </h3>
                  <p style={{ fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
                    Creates a unique invitation URL. Anyone with it can apply to be your student.
                    Students are added to <code style={{ background: '#F3F4F6', padding: '2px 6px', borderRadius: 4, color: '#374151', fontFamily: 'monospace' }}>/Registrations/{'{TeacherName}'}_Students.csv</code>.
                  </p>
                </div>
                <Button onClick={handleGenerateLink} disabled={generatingLink} style={{ background: '#2563EB', color: '#FFF', border: 'none', borderRadius: 6, height: 36, padding: '0 16px', fontWeight: 500, display: 'flex', alignItems: 'center' }}>
                  <Plus style={{ width: 14, height: 14, marginRight: 6 }} />
                  {generatingLink ? 'Generating...' : 'Generate Invite Link'}
                </Button>
              </div>
              {recentLink && (
                <div style={{ padding: '8px 12px', background: '#F7F8FA', border: '1px solid #E4E7EC', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', color: '#111827', wordBreak: 'break-all', userSelect: 'all' }}>
                  {recentLink}
                </div>
              )}
            </div>
          </div>

          {/* Pending Applications Table */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E7EC', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E4E7EC', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: 8, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Clock style={{ width: 14, height: 14, color: '#B45309' }} /> Registration Requests
                <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 12, background: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 600 }}>{students.length}</span>
              </h3>
              <button onClick={fetchStudents} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }} title="Refresh">
                <RefreshCw style={{ width: 14, height: 14 }} />
              </button>
            </div>
            <Table>
              <TableHeader style={{ background: '#FFFFFF' }}>
                <TableRow>
                  <TableHead style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Name</TableHead>
                  <TableHead style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Wallet Address</TableHead>
                  <TableHead style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Status</TableHead>
                  <TableHead style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', textAlign: 'right' }}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.length === 0 ? (
                  <TableRow><TableCell colSpan={4} style={{ textAlign: 'center', padding: '48px 24px', fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' }}>
                    No pending student applications.
                  </TableCell></TableRow>
                ) : students.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{s.name}</TableCell>
                    <TableCell style={{ fontFamily: 'monospace', fontSize: 12, color: '#6B7280' }}>
                      {s.walletAddress.slice(0,10)}...{s.walletAddress.slice(-8)}
                    </TableCell>
                    <TableCell>
                      <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 4, background: '#FEF3C7', color: '#92400E', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>PENDING</span>
                    </TableCell>
                    <TableCell style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button
                          size="sm" variant="ghost"
                          style={{ height: 28, padding: '0 12px', color: '#15803D', fontSize: 12, fontWeight: 700 }}
                          disabled={approvingWallet === s.walletAddress}
                          onClick={() => handleApproveStudent(s)}
                        >
                          <Check style={{ width: 14, height: 14, marginRight: 4 }} />
                          {approvingWallet === s.walletAddress ? '...' : 'Approve'}
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          style={{ height: 28, padding: '0 12px', color: '#B91C1C', fontSize: 12, fontWeight: 700 }}
                          disabled={rejectingWallet === s.walletAddress}
                          onClick={() => handleRejectStudent(s)}
                        >
                          <X style={{ width: 14, height: 14, marginRight: 4 }} />
                          {rejectingWallet === s.walletAddress ? '...' : 'Reject'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Approved Students List */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E7EC', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E4E7EC', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: 8, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Users style={{ width: 14, height: 14, color: '#15803D' }} /> Active Student List
                <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 12, background: '#DCFCE7', color: '#15803D', fontSize: 11, fontWeight: 600 }}>{approvedStudents.length}</span>
              </h3>
            </div>
            <Table>
              <TableHeader style={{ background: '#FFFFFF' }}>
                <TableRow>
                  <TableHead style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Name</TableHead>
                  <TableHead style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Wallet Address</TableHead>
                  <TableHead style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Registry</TableHead>
                  <TableHead style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', textAlign: 'right' }}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvedStudents.length === 0 ? (
                  <TableRow><TableCell colSpan={4} style={{ textAlign: 'center', padding: '48px 24px', fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' }}>
                    No active students in your registry.
                  </TableCell></TableRow>
                ) : approvedStudents.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{s.name}</TableCell>
                    <TableCell style={{ fontFamily: 'monospace', fontSize: 12, color: '#6B7280' }}>
                      {s.walletAddress.slice(0,10)}...{s.walletAddress.slice(-8)}
                    </TableCell>
                    <TableCell style={{ fontSize: 11, color: '#6B7280' }}>
                     {teacherName.replace(/\s+/g,'_')}.csv
                    </TableCell>
                    <TableCell style={{ textAlign: 'right' }}>
                      <Button
                        size="sm" variant="ghost"
                        style={{ height: 28, padding: '0 12px', color: '#B91C1C', fontSize: 12, fontWeight: 700 }}
                        disabled={revokingWallet === s.walletAddress}
                        onClick={() => handleRevokeAccess(s)}
                      >
                        <Trash2 style={{ width: 14, height: 14, marginRight: 4 }} />
                        {revokingWallet === s.walletAddress ? '...' : 'Revoke Access'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2 – EXAM PAPERS
      ══════════════════════════════════════════════════════════════════════ */}
      {section === 'papers' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Upload Paper */}
          <GlassCard className="p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-border/10 pb-4">
              <Upload className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-black uppercase tracking-widest">Upload Question Paper</h3>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Exam Label</Label>
                <Input placeholder="e.g. Midterm_2025" value={examLabel} onChange={e => setExamLabel(e.target.value)} />
              </div>

              {/* Template Download */}
              <button
                onClick={() => downloadTemplate('question')}
                className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-lg hover:bg-muted/20 transition-all text-muted-foreground hover:text-foreground group"
              >
                <Download className="h-4 w-4 group-hover:translate-y-0.5 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-wider">Download Template CSV</span>
              </button>
              <p className="text-[9px] text-muted-foreground text-center">
                Required columns: <code>question, option1, option2, option3, option4, answeroption (1-4), marks</code>
              </p>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Upload File (.csv)</Label>
                <Input id="paper-input" type="file" accept=".csv,.xlsx" onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
              </div>

              <Button className="w-full" onClick={handlePaperUpload} disabled={uploadingPaper}>
                <Upload className="h-3.5 w-3.5 mr-2" />
                {uploadingPaper ? 'Compressing & Anchoring...' : 'Store as Parquet (IPFS)'}
              </Button>

              <p className="text-[9px] text-muted-foreground text-center">
                Path: <code>/Question_paper/{'{Uni}'}/{'{Teacher}'}_{'{ExamName}'}.parquet</code>
              </p>
            </div>
          </GlassCard>

          {/* Uploaded Papers + Answer Key Update */}
          <GlassCard className="p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-border/10 pb-4">
              <ShieldCheck className="h-4 w-4 text-secondary" />
              <h3 className="text-xs font-black uppercase tracking-widest">Uploaded Papers</h3>
              <button onClick={fetchPapers} className="ml-auto text-muted-foreground hover:text-foreground"><RefreshCw className="h-3 w-3" /></button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {papers.length === 0 ? (
                <div className="py-10 text-center text-[9px] uppercase text-muted-foreground/40 font-black italic">No papers stored yet</div>
              ) : papers.map(p => (
                <div key={p} className={`flex items-center justify-between p-3 rounded-lg border bg-muted/10 group ${selectedPaperForKey === p ? 'border-secondary/50 bg-secondary/5' : 'border-border/30'}`}>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-secondary shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-secondary">{p}.parquet</p>
                      <p className="text-[9px] text-muted-foreground uppercase">{university}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPaperForKey(p)}
                    title="Update Answer Key"
                    className={`p-1.5 rounded transition-colors ${selectedPaperForKey === p ? 'bg-secondary text-background' : 'text-muted-foreground hover:text-secondary'}`}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Answer Key Update sub-section */}
            <div className="border-t border-border/10 pt-4 space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-warning">
                Update Answer Key — {selectedPaperForKey || '(select a paper above)'}
              </h4>

              <button
                onClick={() => downloadTemplate('answer')}
                className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-warning/30 rounded-lg hover:bg-warning/5 text-warning/60 hover:text-warning group transition-all"
              >
                <Download className="h-3.5 w-3.5 group-hover:translate-y-0.5 transition-transform" />
                <span className="text-[9px] font-black uppercase">Download Answer Key Template</span>
              </button>
              <p className="text-[9px] text-muted-foreground text-center">Columns: <code>question_no, answer (1-4)</code></p>

              <Input id="key-input" type="file" accept=".csv" onChange={e => setAnswerKeyFile(e.target.files?.[0] ?? null)} className="text-xs" />

              <Button
                variant="outline"
                className="w-full border-warning/40 text-warning hover:bg-warning/10"
                onClick={handleKeyUpdate}
                disabled={updatingKey || !selectedPaperForKey}
              >
                <Edit3 className="h-3.5 w-3.5 mr-2" />
                {updatingKey ? 'Updating IPFS...' : 'Update Answer Key'}
              </Button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 3 – SCHEDULER
      ══════════════════════════════════════════════════════════════════════ */}
      {section === 'scheduler' && (
        <div className="space-y-6">

          {/* Create Schedule form */}
          <GlassCard className="p-6">
            <div className="flex items-center gap-2 mb-5 border-b border-border/10 pb-4">
              <Clock className="h-4 w-4 text-warning" />
              <h3 className="text-xs font-black uppercase tracking-widest">Schedule New Exam</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Select Paper</Label>
                <Select value={schedExam} onValueChange={setSchedExam}>
                  <SelectTrigger><SelectValue placeholder="Choose uploaded paper" /></SelectTrigger>
                  <SelectContent>
                    {papers.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Start Time</Label>
                <Input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">End Time</Label>
                <Input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </div>
            </div>
            <Button className="bg-warning text-background hover:bg-warning/90 font-black" onClick={handleSchedule} disabled={savingSchedule}>
              <Calendar className="h-3.5 w-3.5 mr-2" />
              {savingSchedule ? 'Anchoring to IPFS...' : 'Broadcast Schedule'}
            </Button>
            <p className="text-[9px] text-muted-foreground mt-2">
              Stored at: <code>/Schedules/{'{University}'}/{'{TeacherName}'}/timings.csv</code> · Question updates locked 2 min before start.
            </p>
          </GlassCard>

          {/* Scheduled Exams Table */}
          <GlassCard className="p-0 overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest">Exam Schedule</h3>
              <button onClick={fetchSchedules}><RefreshCw className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /></button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] uppercase">Exam Name</TableHead>
                  <TableHead className="text-[10px] uppercase">Start</TableHead>
                  <TableHead className="text-[10px] uppercase">End</TableHead>
                  <TableHead className="text-[10px] uppercase">Status</TableHead>
                  <TableHead className="text-right text-[10px] uppercase">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-10 text-center text-xs italic text-muted-foreground">No exams scheduled yet.</TableCell></TableRow>
                ) : schedules.map((s, i) => {
                  const isLive = isExamActiveNow(s);
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-bold text-sm">{s.examName}</TableCell>
                      <TableCell className="text-xs">{new Date(s.startTime).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{new Date(s.endTime).toLocaleString()}</TableCell>
                      <TableCell><ExamStatusBadge schedule={s} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {isLive && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" title="Stop Exam" onClick={() => handleStopExam(s.examName)}>
                              <Square className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {!isLive && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-warning" title="Edit Schedule" onClick={() => handleEditSchedule(s)}>
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Delete Schedule" onClick={() => handleDeleteSchedule(s.examName)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </GlassCard>

          {/* Pause individual student */}
          <GlassCard className="p-5 border-warning/20 bg-warning/5">
            <div className="flex items-center gap-2 mb-4">
              <Pause className="h-4 w-4 text-warning" />
              <h3 className="text-xs font-black uppercase tracking-widest text-warning">Pause Specific Student</h3>
            </div>
            <p className="text-[10px] text-muted-foreground mb-4">
              Pause a student during a live exam. They will see: <em>"Exam is paused by teacher. Please contact your teacher."</em>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Exam ID / Name</Label>
                <Input placeholder="exam name" value={pauseExamId} onChange={e => setPauseExamId(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Student Wallet</Label>
                <Input placeholder="0x..." value={pauseTarget} onChange={e => setPauseTarget(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button variant="outline" className="w-full border-warning/40 text-warning hover:bg-warning/10" onClick={handlePauseStudent}>
                  <Pause className="h-3.5 w-3.5 mr-2" /> Pause Student
                </Button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 4 – RESULTS
      ══════════════════════════════════════════════════════════════════════ */}
      {section === 'results' && (
        <div className="space-y-6">
          <GlassCard className="p-5">
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              <div className="flex-1 space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Select Exam to View Results</Label>
                <Select value={resultsExam} onValueChange={v => { setResultsExam(v); fetchResults(v); }}>
                  <SelectTrigger><SelectValue placeholder="Choose an exam" /></SelectTrigger>
                  <SelectContent>
                    {schedules.map(s => <SelectItem key={s.examName} value={s.examName}>{s.examName}</SelectItem>)}
                    {papers.filter(p => !schedules.find(s => s.examName === p)).map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-0 overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/20 flex items-center gap-2">
              <Award className="h-4 w-4 text-warning" />
              <h3 className="text-xs font-black uppercase tracking-widest">
                Student Results {resultsExam && `— ${resultsExam}`}
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] uppercase">#</TableHead>
                  <TableHead className="text-[10px] uppercase">Student Name</TableHead>
                  <TableHead className="text-[10px] uppercase">Wallet</TableHead>
                  <TableHead className="text-[10px] uppercase">Score</TableHead>
                  <TableHead className="text-[10px] uppercase">%</TableHead>
                  <TableHead className="text-[10px] uppercase">Grade</TableHead>
                  <TableHead className="text-[10px] uppercase">Submitted At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingResults ? (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center text-xs italic animate-pulse text-muted-foreground">Fetching from IPFS...</TableCell></TableRow>
                ) : results.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center text-xs italic text-muted-foreground">
                    {resultsExam ? 'No results submitted yet.' : 'Select an exam above.'}
                  </TableCell></TableRow>
                ) : results.map((r, i) => {
                  const pct = r.percentage;
                  const grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : 'F';
                  const gradeColor = pct >= 70 ? 'text-success' : pct >= 60 ? 'text-warning' : 'text-destructive';
                  return (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                      <TableCell className="font-bold">{r.studentName}</TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground">{r.studentWallet.slice(0,8)}...{r.studentWallet.slice(-6)}</TableCell>
                      <TableCell className="font-bold">{r.score} / {r.total}</TableCell>
                      <TableCell>{pct.toFixed(1)}%</TableCell>
                      <TableCell><span className={`font-black text-sm ${gradeColor}`}>{grade}</span></TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">{new Date(r.submittedAt).toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
