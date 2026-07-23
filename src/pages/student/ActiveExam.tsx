import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/context/WalletContext';
import { mfsWriteJSON, mfsReadJSON, mfsAppendBinary, mfsReadCSV } from '@/utils/mfs';
import { ipfsAdd } from '@/utils/ipfs';
import { EncryptionUtils } from '@/encryption';
import { ResultLedgerContract, toBytes32 } from '@/utils/contractUtils';
import { getQuestionPaper, isExamActiveNow, getExamSchedules, type ExamSchedule, type Question, type StudentResult } from '@/utils/examUtils';
import { Shield, Clock, AlertTriangle, Monitor, Mic, Camera, Eye, EyeOff, AlertCircle, ChevronLeft, ChevronRight, CheckSquare } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { toast } from 'sonner';

interface QuestionWithCorrect extends Question {
  correctIndex?: number;
}

export default function ActiveExam() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const { address } = useWallet();
  const { addNotification } = useNotifications();

  const [phase, setPhase] = useState<'checking' | 'instructions' | 'exam' | 'submitted' | 'error'>('checking');
  const [errorMsg, setErrorMsg] = useState('');
  const [schedule, setSchedule] = useState<ExamSchedule | null>(null);
  const [teacherName, setTeacherName] = useState('');
  const [studentName, setStudentName] = useState('Student');
  const [university, setUniversity] = useState('ChainEdu University');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [bufferPath, setBufferPath] = useState('');

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoBufferRef = useRef<Uint8Array[]>([]);
  const videoRefExam = useRef<HTMLVideoElement>(null);
  const videoRefInstruction = useRef<HTMLVideoElement>(null);

  const initExam = useCallback(async () => {
    try {
      if (!address || !examId) return;
      const access = await mfsReadCSV('/Access/students.csv');
      let teacher = 'Admin';
      let sName = 'Student';
      let uni = 'ChainEdu University';

      if (access) {
        const row = access.rows.find(r => r[2]?.toLowerCase() === address.toLowerCase());
        if (row) {
          teacher = row[3];
          sName = row[1];
          uni = row[5] || 'ChainEdu University';
        }
      }
      setStudentName(sName);
      setUniversity(uni);
      setTeacherName(teacher);

      const schedules = await getExamSchedules(uni, teacher);
      const sch = schedules.find(s => s.examName === examId);
      if (!sch) { setErrorMsg('Exam not found'); setPhase('error'); return; }
      setSchedule(sch);

      if (!isExamActiveNow(sch)) { setErrorMsg('Exam is not active'); setPhase('error'); return; }
      
      const endMs = new Date(sch.endTime).getTime();
      setTimeLeft(Math.max(0, Math.floor((endMs - Date.now()) / 1000)));

      const qs = await getQuestionPaper(uni, teacher, examId);
      setQuestions(qs.map(q => ({ ...q, marks: Number(q.marks) || 1 })));

      const bPath = `/Buffer/${uni.replace(/\s+/g,'_')}/${teacher.replace(/\s+/g,'_')}/${sName.replace(/\s+/g,'_')}/Temp.json`;
      setBufferPath(bPath);

      const localBuf = localStorage.getItem(`chainEdu_buffer_${address}_${examId}`);
      if (localBuf) setAnswers(JSON.parse(localBuf));

      const hasStarted = localStorage.getItem(`chainEdu_exam_started_${address}_${examId}`) === 'true';
      if (hasStarted) setPhase('exam');
      else setPhase('instructions');

    } catch (err: any) {
      setErrorMsg(err.message || 'Error');
      setPhase('error');
    }
  }, [address, examId]);

  useEffect(() => { initExam(); }, [initExam]);

  const requestPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStreamRef.current = stream;
      if (videoRefInstruction.current) videoRefInstruction.current.srcObject = stream;
      setPermissionGranted(true);
      
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp8,opus', videoBitsPerSecond: 50000 });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          const buffer = new Uint8Array(await e.data.arrayBuffer());
          const safeUni = university.replace(/\s+/g,'_');
          const safeTeacher = teacherName.replace(/\s+/g,'_');
          const safeStudent = studentName.replace(/\s+/g,'_');
          const recPath = `/Recordings/${safeUni}/${safeTeacher}/${safeStudent}/${safeStudent}.HEVC`;
          await mfsAppendBinary(recPath, buffer).catch(() => videoBufferRef.current.push(buffer));
        }
      };
    } catch (err) {
      toast.error("Camera and Microphone are mandatory.");
    }
  };

  const startExam = () => {
    if (!permissionGranted) { alert('Grant permissions first'); return; }
    localStorage.setItem(`chainEdu_exam_started_${address}_${examId}`, 'true');
    setPhase('exam');
    if (mediaRecorderRef.current) mediaRecorderRef.current.start(10000);
  };

  const calculateCurrentScore = (ans: Record<number, number>) => {
    let score = 0;
    questions.forEach((q, i) => {
      if (ans[i] === Number(q.answeroption)) {
        score += Number(q.marks || 1);
      } else if (ans[i] !== undefined && q.negative_marks) {
        score -= Number(q.negative_marks);
      }
    });
    return Math.max(0, score);
  };

  const syncBuffer = async (ans: Record<number, number>) => {
    if (bufferPath) await mfsWriteJSON(bufferPath, ans).catch(() => {});
  };

  const updateAnswer = (qid: number, opt: number) => {
    const newAns = { ...answers, [qid]: opt };
    setAnswers(newAns);
    localStorage.setItem(`chainEdu_buffer_${address}_${examId}`, JSON.stringify(newAns));
    syncBuffer(newAns);
  };

  const submitExam = async () => {
    if (isSubmitting || !address) return;
    setIsSubmitting(true);
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();

    try {
      const finalScore = calculateCurrentScore(answers);
      const safeUni = university.replace(/\s+/g,'_');
      const safeTeacher = teacherName.replace(/\s+/g,'_');
      const safeExam = (examId as string).replace(/\s+/g,'_');
      const safeStudent = studentName.replace(/\s+/g,'_');
      
      const shortWallet = address.slice(2, 8).toLowerCase();
      const perfPath = `/Performance/${safeUni}/${safeTeacher}/${safeExam}/${safeStudent}${shortWallet}.enc`;
      const encPerf = EncryptionUtils.encryptAES(performance); // performance is already an array
      await mfsWriteJSON(perfPath, { data: encPerf });

      // Result
      const resultObj: StudentResult = {
        examId: examId!,
        studentName,
        studentWallet: address,
        score: finalScore,
        total: questions.length,
        percentage: (finalScore / (questions.length || 1)) * 100,
        submittedAt: new Date().toISOString(),
        university,
      };

      const resultJSON = JSON.stringify(resultObj);
      const cid = await ipfsAdd(EncryptionUtils.encryptAES(resultJSON));

      // Blockchain Anchor
      const contract = ResultLedgerContract();
      if (contract) {
        const examHash = toBytes32(examId!);
        // EncryptionUtils.hashSHA256 already includes '0x'
        const resHash = EncryptionUtils.hashSHA256(resultJSON);
        
        // Convert to integers to prevent contract revert
        const integerScore = Math.floor(finalScore);
        const integerTotal = questions.length;

        await contract.methods.submitResult(
          address,
          examHash,
          resHash,
          cid,
          integerScore,
          integerTotal
        ).send({ from: address, gas: 300000 });
      }

      // Teacher CSV Backup (Ensures instructor visibility)
      const { saveStudentResult } = await import('@/utils/examUtils');
      await saveStudentResult(examId!, resultObj).catch(() => {});

      // Cleanup
      if (bufferPath) await mfsWriteJSON(bufferPath, {});
      localStorage.removeItem(`chainEdu_buffer_${address}_${examId}`);
      localStorage.setItem(`chainEdu_submitted_${address.toLowerCase()}_${examId}`, 'true');
      setPhase('submitted');
      toast.success("Exam submitted on-chain!");
    } catch (err) {
      toast.error("Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (phase === 'exam') {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { clearInterval(timer); submitExam(); return 0; }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [phase]);

  if (phase === 'checking') return <div className="p-20 text-center animate-pulse">Initializing SECURE-EXAM Environment...</div>;
  if (phase === 'error') return <div className="p-20 text-center text-rose-600 font-bold">{errorMsg}</div>;
  if (phase === 'submitted') return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
       <div className="bg-white p-12 border rounded-3xl shadow-xl text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
             <CheckSquare className="text-emerald-600 w-10 h-10" />
          </div>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">Session Anchored</h2>
          <p className="text-slate-500 max-w-sm mx-auto">Your responses and proctoring logs have been moved to the decentralized ledger. mapping. mapping. mapping. mapping.</p>
          <Button onClick={() => navigate('/student')} className="w-full bg-slate-900 text-white font-bold h-12 rounded-xl">Back to Portal</Button>
       </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {phase === 'instructions' ? (
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
           <div className="bg-white border p-8 rounded-3xl shadow-sm space-y-6">
              <h1 className="text-3xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                <Shield className="text-blue-600" /> Proctoring Setup
              </h1>
              <div className="space-y-4 text-slate-600 leading-relaxed font-medium">
                <p>1. Ensure your camera and microphone are ON throughout the session.</p>
                <p>2. Live recording is active and chuncked to IPFS MFS for integrity.</p>
                <p>3. Do not refresh or exit the fullscreen mode once the exam starts.</p>
              </div>

              <div className="aspect-video bg-slate-900 rounded-2xl overflow-hidden border-4 border-slate-100 relative group">
                <video ref={videoRefInstruction} autoPlay muted playsInline className="w-full h-full object-cover" />
                {!permissionGranted && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
                    <Button onClick={requestPermissions} className="bg-white text-slate-900 font-bold px-8 h-12 rounded-xl hover:scale-105 transition-transform">Enable Camera & Mic</Button>
                  </div>
                )}
              </div>

              <Button onClick={startExam} disabled={!permissionGranted} className="w-full bg-blue-600 text-white font-bold h-14 rounded-2xl text-lg shadow-lg shadow-blue-200 hover:bg-blue-700">
                Acknowledge and Start
              </Button>
           </div>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-6">
              <div className="bg-white border p-8 rounded-3xl shadow-sm min-h-[400px] flex flex-col">
                 <div className="flex justify-between items-center mb-10">
                    <span className="text-[10px] font-black uppercase bg-slate-100 px-3 py-1 rounded-full text-slate-500">Question {currentQ + 1} of {questions.length}</span>
                    <div className="flex items-center gap-2 text-rose-600 font-black tracking-tighter">
                       <Clock size={16} /> 
                       {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </div>
                 </div>
                 
                 <h2 className="text-xl font-bold text-slate-900 mb-8 leading-tight">{questions[currentQ].question}</h2>
                 
                 <div className="space-y-3 flex-1">
                    {[
                      questions[currentQ].option1,
                      questions[currentQ].option2,
                      questions[currentQ].option3,
                      questions[currentQ].option4
                    ].map((opt, i) => (
                       <button
                         key={i}
                         onClick={() => updateAnswer(currentQ, i + 1)}
                         className={`w-full p-4 rounded-xl border text-left font-bold transition-all ${answers[currentQ] === (i + 1) ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-blue-200'}`}
                       >
                         {String.fromCharCode(65 + i)}. {opt}
                       </button>
                    ))}
                 </div>

                 <div className="flex justify-between pt-8 border-t mt-8">
                    <Button variant="ghost" onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} className="gap-2 font-bold"><ChevronLeft size={18}/> Back</Button>
                    {currentQ === questions.length - 1 ? (
                      <Button onClick={submitExam} disabled={isSubmitting} className="bg-emerald-600 text-white font-bold px-8 h-12 rounded-xl">FINISH & ANCHOR</Button>
                    ) : (
                      <Button onClick={() => setCurrentQ(currentQ + 1)} className="bg-slate-900 text-white font-bold px-8 h-12 rounded-xl gap-2">Next <ChevronRight size={18}/></Button>
                    )}
                 </div>
              </div>
           </div>

           <div className="space-y-6">
              <div className="bg-slate-900 rounded-3xl overflow-hidden border-4 border-white shadow-xl aspect-video relative">
                 <video ref={videoRefExam} autoPlay muted playsInline className="w-full h-full object-cover grayscale contrast-125" />
                 <div className="absolute top-4 left-4 flex items-center gap-2">
                    <div className="w-2 h-2 bg-rose-600 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">Live Proctoring</span>
                 </div>
              </div>
              
              <div className="bg-white border p-6 rounded-3xl shadow-sm">
                 <h3 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-widest">Jump to Question</h3>
                 <div className="grid grid-cols-5 gap-2">
                    {questions.map((_, i) => (
                       <button
                         key={i}
                         onClick={() => setCurrentQ(i)}
                         className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold ${currentQ === i ? 'bg-blue-600 text-white' : answers[i] !== undefined ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}
                       >
                         {i + 1}
                       </button>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
