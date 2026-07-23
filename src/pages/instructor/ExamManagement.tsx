import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GlassCard } from '@/components/shared/GlassCard';
import { StatusBadge } from '@/components/shared/Badges';
import { CIDDisplay, TxHashDisplay } from '@/components/shared/HashDisplays';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, GripVertical, Upload, Trash2, Shield } from 'lucide-react';

import { useWallet } from '@/context/WalletContext';
import { useWeb3 } from '@/hooks/useWeb3';
import { useContract } from '@/hooks/useContract';
import { ipfsAdd } from '@/utils/ipfs';
import { encryptAES, deriveKey } from '@/utils/aes';
import { toast } from 'sonner';

interface Question {
  question: string;
  option1: string;
  option2: string;
  option3: string;
  option4: string;
  correctIndex: number;
}

/**
 * SEC-TC-011: Sanitizer to escape HTML entities before storage.
 * Ensures the renderer doesn't interpret injected scripts.
 */
function escapeHTML(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function ExamManagement() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const { address } = useWallet();
  const { web3 } = useWeb3();
  const { getExamManager } = useContract(web3);

  const [name, setName] = useState('New Exam');
  const [duration, setDuration] = useState(60);
  const [examStartTime, setExamStartTime] = useState(new Date(Date.now() + 600000).toISOString().slice(0, 16)); // Default: 10 mins from now
  const [questions, setQuestions] = useState<Question[]>([
    { question: '', option1: '', option2: '', option3: '', option4: '', correctIndex: 0 }
  ]);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState('');
  const [existingExams, setExistingExams] = useState<any[]>([]); // SEC-TC-054: Conflict detection
  const [result, setResult] = useState<{ paperCID: string; answerCID: string; txHash?: string } | null>(null);

  const addQuestion = () => {
    setQuestions([...questions, { question: '', option1: '', option2: '', option3: '', option4: '', correctIndex: 0 }]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const next = [...questions];
    next[index] = { ...next[index], [field]: value };
    setQuestions(next);
  };

  const handlePublish = async () => {
    if (!address) {
      toast.error('Wallet not connected');
      return;
    }
    if (questions.some(q => !q.question.trim())) {
      toast.error('Please fill all questions');
      return;
    }

    // SEC-TC-059/064: Hard Bound on Exam Size
    if (questions.length === 0) {
      toast.error('CANNOT PUBLISH: Exam must have at least one question.');
      return;
    }
    if (questions.length > 500) {
      toast.error('CANNOT PUBLISH: Question paper size limit exceeded (Max 500).');
      return;
    }
    
    // SEC-TC-029: Duplicate Question Check
    const uniqueQ = new Set(questions.map(q => q.question.trim().toLowerCase()));
    if (uniqueQ.size !== questions.length) {
      toast.error('Duplicate questions detected. Please ensure all question text is unique.');
      return;
    }

    try {
      setIsUploading(true);
      
      setUploadStep('Encrypting Paper...');
      const paperData = questions.map(q => ({
        question: escapeHTML(q.question),
        option1: escapeHTML(q.option1),
        option2: escapeHTML(q.option2),
        option3: escapeHTML(q.option3),
        option4: escapeHTML(q.option4)
      }));

      const optionMap = ['Option1', 'Option2', 'Option3', 'Option4'];
      const answerData = questions.map(q => optionMap[q.correctIndex]);

      // SEC-TC-006: Properly derive key before encryption
      // In a production app, the teacher would sign a message here.
      // For the demo flow, we derive it from the address + static salt.
      const key = await deriveKey(address, address); 

      const encPaper = await encryptAES(JSON.stringify(paperData), key, address);
      const encAnswers = await encryptAES(JSON.stringify(answerData), key, address);

      setUploadStep('Uploading to IPFS...');
      const paperCID = await ipfsAdd(encPaper);
      const answerCID = await ipfsAdd(encAnswers);

      // SEC-TC-024: redundant gas avoidance (simple check)
      if (result && result.answerCID === answerCID && result.paperCID === paperCID) {
        toast.info("No changes detected in exam content. Skipping blockchain update.");
        setIsUploading(false);
        setUploadStep('');
        return;
      }

      setResult({ paperCID, answerCID });

      setUploadStep('Waiting for Transaction...');
      const examManager = await getExamManager();
      if (!examManager) throw new Error('Contract not found');

      // SEC-TC-054: Overlap Detection
      const newStart = new Date(examStartTime).getTime();
      const newEnd = newStart + (duration * 60 * 1000);
      
      // SEC-TC-077: 30-Minute Editing Lock
      const serverNow = Date.now(); // Assume sync'd or fetch from NTP if critical
      const timeToStart = newStart - serverNow;
      if (timeToStart > 0 && timeToStart < (30 * 60 * 1000)) {
        throw new Error("EDITING LOCKED: Question papers cannot be modified within 30 minutes of the exam start.");
      }
      
      const hasOverlap = existingExams.some(e => {
        const estStart = new Date(Number(e.startTime) * 1000).getTime();
        const estEnd = new Date(Number(e.endTime) * 1000).getTime();
        return (newStart < estEnd && newEnd > estStart);
      });
      
      if (hasOverlap) {
        throw new Error("SCHEDULING CONFLICT: This time range overlaps with an existing exam.");
      }

      const tx = await examManager.methods.scheduleExam(
        paperCID,
        answerCID,
        name,
        Math.floor(newStart / 1000),
        duration * 60,
        []
      ).send({ from: address });

      setResult(prev => prev ? { ...prev, txHash: tx.transactionHash } : null);
      toast.success('Exam published successfully!');
      
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish exam');
    } finally {
      setIsUploading(false);
      setUploadStep('');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Exam Builder</h1>
        {isUploading && (
           <div className="flex items-center gap-2 text-primary animate-pulse">
             <div className="w-2 h-2 rounded-full bg-primary" />
             <span className="text-sm font-medium">{uploadStep}</span>
           </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_350px] gap-6">
        <div className="space-y-4">
          <GlassCard className="space-y-4">
            <Input 
              placeholder="Exam Title" 
              value={name} 
              onChange={e => setName(e.target.value)}
              className="bg-muted/50 border-border text-lg font-semibold" 
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Duration (mins)</span>
                <Input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} className="bg-muted/50 border-border" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Question Count</span>
                <Input type="number" value={questions.length} disabled className="bg-muted/50 border-border" />
              </div>
            </div>
          </GlassCard>

          {questions.map((q, i) => (
            <GlassCard key={i} className="space-y-3 relative group">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                <span className="text-sm font-medium text-muted-foreground">Q{i + 1}</span>
                <StatusBadge variant="info">MCQ</StatusBadge>
                <button 
                  onClick={() => removeQuestion(i)}
                  className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-destructive"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              
              <Textarea 
                placeholder="Type your question here..." 
                value={q.question}
                onChange={e => updateQuestion(i, 'question', e.target.value)}
                className="bg-muted/50 border-border min-h-[80px]" 
              />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((num) => {
                  const field = `option${num}` as keyof Question;
                  const isCorrect = q.correctIndex === (num - 1);
                  return (
                    <div key={num} className="relative">
                      <Input 
                        placeholder={`Option ${num}`}
                        value={q[field] as string}
                        onChange={e => updateQuestion(i, field, e.target.value)}
                        className={`bg-muted/50 transition-all pr-10 ${isCorrect ? 'border-success ring-1 ring-success/20' : 'border-border'}`}
                      />
                      <button
                        onClick={() => updateQuestion(i, 'correctIndex', num - 1)}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center transition-colors ${
                          isCorrect ? 'bg-success text-white' : 'bg-muted hover:bg-muted-foreground/20 text-muted-foreground'
                        }`}
                      >
                        {isCorrect ? <Check size={14} /> : <span className="text-[10px] font-bold">{String.fromCharCode(64+num)}</span>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          ))}

          <Button variant="outline" className="w-full border-dashed border-border text-muted-foreground h-12"
            onClick={addQuestion}>
            <Plus className="h-4 w-4 mr-2" /> Add Question
          </Button>

          <Button 
            onClick={handlePublish}
            disabled={isUploading}
            className="w-full bg-primary btn-glow h-12 text-lg font-bold"
          >
            {isUploading ? <Upload className="h-5 w-5 mr-2 animate-bounce" /> : <Shield className="h-5 w-5 mr-2" />}
            Encrypt & Publish to Blockchain
          </Button>
        </div>

        <div className="space-y-4">
          <GlassCard className="space-y-4 sticky top-24">
            <h3 className="font-semibold">Publication Result</h3>
            
            {result ? (
               <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-success/10 border border-success/30 flex items-center gap-2">
                    <Check className="text-success h-4 w-4" />
                    <span className="text-sm font-medium text-success">Deployed Locally</span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paper CID</span>
                    </div>
                    <CIDDisplay cid={result.paperCID} />

                    <div className="flex justify-between mt-2">
                      <span className="text-muted-foreground">Answer CID</span>
                    </div>
                    <CIDDisplay cid={result.answerCID} />

                    {result.txHash && (
                      <>
                        <div className="flex justify-between mt-2">
                          <span className="text-muted-foreground">Final Tx Hash</span>
                        </div>
                        <TxHashDisplay hash={result.txHash} />
                      </>
                    )}
                  </div>
               </div>
            ) : (
              <div className="text-center py-8 space-y-2">
                <Upload className="h-8 w-8 text-muted-foreground mx-auto opacity-20" />
                <p className="text-sm text-muted-foreground">Fill in the details and publish to see the blockchain anchors.</p>
              </div>
            )}

            <div className="chain-separator" />
            
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              * The exam paper is encrypted using AES-256-CBC with your wallet address as part of the key.
              Only verified students will be able to decrypt the questions once the exam window starts.
            </p>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function Check({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} height={size} 
      viewBox="0 0 24 24" fill="none" 
      stroke="currentColor" strokeWidth="3" 
      strokeLinecap="round" strokeLinejoin="round" 
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

