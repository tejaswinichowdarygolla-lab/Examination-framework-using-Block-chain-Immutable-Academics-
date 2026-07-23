/**
 * examUtils.ts
 * Centralized utility for all teacher exam management operations.
 * IPFS paths follow the spec:
 *   Question_paper/{University}/{teacher_name}_{exam_name}.parquet  (stored as JSON)
 *   Schedules/{University}/{TeacherName}/timings.csv
 *   ExamControl/{examId}/control.json  — { status, pausedStudents[] }
 *   ExamControl/{examId}/results.csv
 */

import { mfsReadJSON, mfsWriteJSON, mfsReadCSV, mfsWriteCSV, mfsAppendCSVRow, mfsList, MFS } from './mfs';
import { logAudit, TEACHER_ACCESS_HEADERS } from './registrationLinks';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Question {
  question: string;
  option1: string;
  option2: string;
  option3: string;
  option4: string;
  answeroption: number; // 1-4
  marks?: number;
  negative_marks?: number;
}

export interface AnswerKeyRow {
  question_no: number;
  answer: number;
}

export type ExamStatus = 'active' | 'stopped';

export interface ExamSchedule {
  teacherName: string;
  examName: string;
  startTime: string; // ISO
  endTime: string;   // ISO
}

export interface ExamControl {
  status: ExamStatus;
  pausedStudents: string[]; // wallet addresses
  stoppedAt?: string;
}

export interface StudentResult {
  examId: string;
  studentName: string;
  studentWallet: string;
  score: number;
  total: number;
  percentage: number;
  submittedAt: string;
  university?: string;
}

// ── Path Helpers ─────────────────────────────────────────────────────────────

export function safeName(s: string) { return s.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, ''); }

export function questionPaperPath(uni: string, teacher: string, examName: string) {
  return `/Question_paper/${safeName(uni)}/${safeName(teacher)}_${safeName(examName)}.parquet`;
}

export function examSchedulePath(uni: string, teacher: string) {
  return `/Schedules/${safeName(uni)}/${safeName(teacher)}/timings.csv`;
}

export function examControlPath(examId: string) {
  return `/ExamControl/${safeName(examId)}/control.json`;
}

export function examResultsPath(examId: string) {
  return `/ExamControl/${safeName(examId)}/results.csv`;
}

export function teacherStudentsPath(teacher: string) {
  return `/Registrations/${safeName(teacher)}_Students.csv`;
}

const STUDENT_ACCESS_PATH = '/Access/students.csv';

// ── Headers ──────────────────────────────────────────────────────────────────

const TIMINGS_HEADERS = ['TeacherName', 'ExamName', 'StartTime', 'EndTime'];
const TEACHER_STUDENT_HEADERS = ['student_name', 'wallet_address', 'teacher_name', 'link_id', 'status'];
const STUDENT_ACCESS_HEADERS = ['Id', 'Name', 'WalletAddress', 'TeacherName', 'Status', 'University'];
export const QUESTION_PAPER_TEMPLATE_HEADERS = 'question,option1,option2,option3,option4,answeroption,marks,negative_marks';
export const ANSWER_KEY_TEMPLATE_HEADERS = 'question_no,answer';

// ── Parquet (MFS JSON Wrapper) Operations ───────────────────────────────────

/**
 * Stores a question paper.
 * Validates 'marks' column; defaults to 1 if missing.
 */
export async function storeQuestionPaper(
  uni: string,
  teacher: string,
  examName: string,
  questions: any[]
): Promise<void> {
  const path = questionPaperPath(uni, teacher, examName);
  
  // Ensure structured format
  const structured = questions.map(q => ({
    question: q.question || '',
    option1: q.option1 || '',
    option2: q.option2 || '',
    option3: q.option3 || '',
    option4: q.option4 || '',
    answeroption: Number(q.answeroption) || 1,
    marks: q.marks !== undefined && q.marks !== '' ? Number(q.marks) : 1,
    negative_marks: q.negative_marks !== undefined && q.negative_marks !== '' ? Number(q.negative_marks) : 0
  }));

  const payload = {
    metadata: {
      uni,
      teacher,
      examName,
      createdAt: new Date().toISOString(),
      questionCount: structured.length
    },
    data: structured
  };

  await mfsWriteJSON(path, payload);
  await logAudit('UPLOAD_PAPER', 'EXAM', teacher, `Uploaded paper "${examName}" with ${structured.length} questions.`);
}

export async function getQuestionPaper(uni: string, teacher: string, examName: string): Promise<Question[] | null> {
  const path = questionPaperPath(uni, teacher, examName);
  const payload = await mfsReadJSON<any>(path);
  return payload?.data ?? null;
}

/**
 * Update only the answer column of an existing parquet paper.
 */
export async function updateAnswerKey(
  uni: string,
  teacher: string,
  examName: string,
  answers: AnswerKeyRow[]
): Promise<void> {
  const path = questionPaperPath(uni, teacher, examName);
  const payload = await mfsReadJSON<any>(path);
  if (!payload) throw new Error(`Paper not found: ${examName}`);

  const updated = payload.data.map((q: Question, idx: number) => {
    const keyRow = answers.find(a => a.question_no === idx + 1);
    return keyRow ? { ...q, answeroption: keyRow.answer } : q;
  });
  await mfsWriteJSON(path, { ...payload, data: updated, metadata: { ...payload.metadata, answerKeyUpdatedAt: new Date().toISOString() } });
  await logAudit('UPDATE_ANSWER_KEY', 'EXAM', teacher, `Answer key updated for "${examName}"`);
}

/**
 * List paper names for a teacher in a university folder.
 */
export async function listQuestionPapers(uni: string, teacher: string): Promise<string[]> {
  const folderPath = `/Question_paper/${safeName(uni)}`;
  const allFiles = await mfsList(folderPath);
  const prefix = safeName(teacher) + '_';
  return allFiles.filter(f => f.startsWith(prefix) && f.endsWith('.parquet'))
                 .map(f => f.slice(prefix.length, -'.parquet'.length)); // return exam names
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

export async function scheduleExam(uni: string, schedule: ExamSchedule): Promise<void> {
  const path = examSchedulePath(uni, schedule.teacherName);
  const row = [schedule.teacherName, schedule.examName, schedule.startTime, schedule.endTime];
  await mfsAppendCSVRow(path, TIMINGS_HEADERS, row);
  await logAudit('SCHEDULE_EXAM', 'EXAM', schedule.teacherName, `Scheduled "${schedule.examName}" from ${schedule.startTime} to ${schedule.endTime}`);
}

export async function getExamSchedules(uni: string, teacher: string): Promise<ExamSchedule[]> {
  const path = examSchedulePath(uni, teacher);
  const data = await mfsReadCSV(path);
  if (!data) return [];
  return data.rows.map(r => ({
    teacherName: r[0],
    examName: r[1],
    startTime: r[2],
    endTime: r[3],
  }));
}

export async function deleteExamSchedule(uni: string, teacher: string, examName: string): Promise<void> {
  const path = examSchedulePath(uni, teacher);
  const data = await mfsReadCSV(path);
  if (!data) return;
  const filtered = data.rows.filter(r => r[1] !== examName);
  await mfsWriteCSV(path, TIMINGS_HEADERS, filtered);
}

/** Returns schedule entry if current time is within exam window, else null. */
export function isExamActiveNow(schedule: ExamSchedule): boolean {
  const now = Date.now();
  return now >= new Date(schedule.startTime).getTime() && now <= new Date(schedule.endTime).getTime();
}

/** Check if update is allowed (must be >2 min before start OR after it ends) */
export function canUpdateBeforeExam(schedule: ExamSchedule): boolean {
  const now = Date.now();
  const start = new Date(schedule.startTime).getTime();
  const end = new Date(schedule.endTime).getTime();
  
  // 1. If exam has ended, always allow updates (for post-exam re-evaluation)
  if (now > end) return true;
  
  // 2. Otherwise, must be at least 2 minutes before the exam starts
  return (start - now) >= 2 * 60 * 1000;
}

// ── Exam Control ──────────────────────────────────────────────────────────────

const DEFAULT_CONTROL: ExamControl = { status: 'active', pausedStudents: [] };

export async function getExamControl(examId: string): Promise<ExamControl> {
  const ctrl = await mfsReadJSON<ExamControl>(examControlPath(examId));
  return ctrl ?? DEFAULT_CONTROL;
}

export async function setExamControl(examId: string, control: ExamControl): Promise<void> {
  await mfsWriteJSON(examControlPath(examId), control);
}

export async function stopExam(examId: string, teacher: string): Promise<void> {
  const existing = await getExamControl(examId);
  await setExamControl(examId, { ...existing, status: 'stopped', stoppedAt: new Date().toISOString() });
  await logAudit('STOP_EXAM', 'EXAM', teacher, `Exam "${examId}" stopped by teacher`);
}

export async function pauseStudentExam(examId: string, studentWallet: string, teacher: string): Promise<void> {
  const ctrl = await getExamControl(examId);
  const wallet = studentWallet.toLowerCase();
  if (!ctrl.pausedStudents.includes(wallet)) {
    ctrl.pausedStudents.push(wallet);
  }
  await setExamControl(examId, ctrl);
  await logAudit('PAUSE_STUDENT', 'EXAM', teacher, `Student ${wallet} paused in exam "${examId}"`);
}

export async function resumeStudentExam(examId: string, studentWallet: string, teacher: string): Promise<void> {
  const ctrl = await getExamControl(examId);
  ctrl.pausedStudents = ctrl.pausedStudents.filter(w => w !== studentWallet.toLowerCase());
  await setExamControl(examId, ctrl);
  await logAudit('RESUME_STUDENT', 'EXAM', teacher, `Student ${studentWallet} resumed in exam "${examId}"`);
}

// ── Encrypted Storage Layer ──────────────────────────────────────────────────

export async function storePerformanceEncrypted(
  uni: string,
  teacher: string,
  examName: string,
  studentName: string,
  walletAddress: string,
  performances: { option_selected: number | null; correct_option: number }[]
) {
  const { EncryptionUtils } = await import('@/encryption');
  const shortWallet = walletAddress.slice(2, 8).toLowerCase();
  const path = `/Performance/${safeName(uni)}/${safeName(teacher)}/${safeName(examName)}/${safeName(studentName)}${shortWallet}.enc`;
  
  // SEC-TC-052: Unified JSON Array format for performance auditing
  const encryptedFile = EncryptionUtils.encryptAES(performances);
  await mfsWriteJSON(path, { data: encryptedFile });
}

export async function storeResultEncrypted(
  uni: string,
  teacher: string,
  examName: string,
  walletAddress: string,
  result: StudentResult
) {
  const { EncryptionUtils } = await import('@/encryption');
  const path = `/Results/${safeName(uni)}/${safeName(teacher)}/${safeName(examName)}/${walletAddress.toLowerCase()}.enc`;
  
  const encryptedFile = EncryptionUtils.encryptAES({ ...result, university: uni });
  await mfsWriteJSON(path, { data: encryptedFile });
}

export async function saveStudentResult(examId: string, result: StudentResult): Promise<void> {
  const path = examResultsPath(examId);
  const row = [
    result.examId,
    result.studentName,
    result.studentWallet,
    result.score.toString(),
    result.total.toString(),
    result.percentage.toFixed(2),
    result.submittedAt
  ];
  await mfsAppendCSVRow(path, ['ExamId', 'Name', 'Wallet', 'Score', 'Total', 'Percentage', 'Timestamp'], row);
}

export async function getExamResults(examId: string): Promise<StudentResult[]> {
  const path = examResultsPath(examId);
  const data = await mfsReadCSV(path);
  if (!data) return [];
  return data.rows.map(r => ({
    examId: r[0],
    studentName: r[1],
    studentWallet: r[2],
    score: parseInt(r[3]),
    total: parseInt(r[4]),
    percentage: parseFloat(r[5]),
    submittedAt: r[6],
  }));
}

export async function getEncryptedResult(
  uni: string,
  teacher: string,
  examName: string,
  walletAddress: string
): Promise<StudentResult | null> {
  const { EncryptionUtils } = await import('@/encryption');
  const path = `/Results/${safeName(uni)}/${safeName(teacher)}/${safeName(examName)}/${walletAddress.toLowerCase()}.enc`;
  const encrypted = await mfsReadJSON<any>(path);
  if (!encrypted?.data) return null;
  const decrypted = EncryptionUtils.decryptAES(encrypted.data);
  return JSON.parse(decrypted) as StudentResult;
}

export async function getStudentNameByWallet(wallet: string): Promise<string> {
  const data = await mfsReadCSV(STUDENT_ACCESS_PATH);
  if (!data) return 'Student';
  const row = data.rows.find(r => r[2]?.toLowerCase() === wallet.toLowerCase());
  return row ? row[1] : 'Student';
}

export async function getStudentPerformance(
  uni: string,
  teacher: string,
  examName: string,
  studentName: string,
  walletAddress: string
): Promise<{ option_selected: number | null; correct_option: number }[]> {
  const { EncryptionUtils } = await import('@/encryption');
  const shortWallet = walletAddress.slice(2, 8).toLowerCase();
  const path = `/Performance/${safeName(uni)}/${safeName(teacher)}/${safeName(examName)}/${safeName(studentName)}${shortWallet}.enc`;
  
  const payload = await mfsReadJSON<any>(path);
  if (!payload?.data) return [];
  
  const decrypted: string = EncryptionUtils.decryptAES(payload.data);
  const data = JSON.parse(decrypted);
  
  // Standard format: JSON Array of objects
  const perfArray = Array.isArray(data) ? data : (data.data && Array.isArray(data.data) ? data.data : []);
  
  // Handle case where data might still be the old CSV string format (fallback for safety)
  if (!Array.isArray(perfArray) && typeof data.data === 'string') {
     const rows = data.data.split('\n').filter((r: string) => r.includes(',')).slice(1);
     return rows.map((r: string) => {
        const [sel, cor] = r.split(',');
        return { option_selected: sel ? parseInt(sel) : null, correct_option: parseInt(cor) };
     });
  }

  return perfArray.map((p: any) => ({
    option_selected: p.option_selected !== undefined ? p.option_selected : null,
    correct_option: p.correct_option
  }));
}

// ── Student Registry per Teacher ─────────────────────────────────────────────

export async function addStudentToTeacherRegistry(
  teacherName: string,
  student: { name: string; walletAddress: string },
  status: 'pending' | 'approved' = 'pending'
): Promise<void> {
  const path = teacherStudentsPath(teacherName);
  const row = [student.name, student.walletAddress.toLowerCase(), teacherName, 'DIRECT', status];
  await mfsAppendCSVRow(path, TEACHER_STUDENT_HEADERS, row);
}

export async function approveStudentInRegistry(teacherName: string, walletAddress: string): Promise<void> {
  const path = teacherStudentsPath(teacherName);
  const data = await mfsReadCSV(path);
  if (!data) return;
  const normalized = walletAddress.toLowerCase();
  const updated = data.rows.map(r => {
    if (r[1].toLowerCase() === normalized) {
      const row = [...r];
      row[4] = 'approved';
      return row;
    }
    return r;
  });
  await mfsWriteCSV(path, ['student_name', 'wallet_address', 'teacher_name', 'link_id', 'status'], updated);
}

export async function getTeacherStudents(teacherName: string): Promise<{ name: string; walletAddress: string; teacherName: string }[]> {
  const path = teacherStudentsPath(teacherName);
  const data = await mfsReadCSV(path);
  return data.rows
    .filter(r => r[4] === 'approved') // Only show approved students in Active list
    .map(r => ({ name: r[0], walletAddress: r[1], teacherName: r[2] }));
}

/** Teacher approves student → add to /Access/students.csv */
export async function grantStudentAccess(submission: any): Promise<void> {
  const normalized = submission[5].toLowerCase();
  
  // 1. Check for duplicates in the access file itself
  const existing = await mfsReadCSV(STUDENT_ACCESS_PATH);
  if (existing?.rows.some(r => r[2].toLowerCase() === normalized)) {
     console.warn("[Registry] Student already in access list:", normalized);
     return;
  }

  if (submission[2] === 'Student' || submission[2] === 'STUDENT') {
    const studentHeaders = ['Id', 'Name', 'WalletAddress', 'TeacherName', 'Status', 'University']; 
    const accessRow = [submission[0], submission[1], normalized, submission[8] || 'Teacher', 'active', submission[3] || 'ChainEdu University'];
    await mfsAppendCSVRow(STUDENT_ACCESS_PATH, studentHeaders, accessRow);
  } else if (submission[2] === 'Teacher' || submission[2] === 'TEACHER') {
      // Deduplication check for TeachersAccess
      const existingT = await mfsReadCSV(MFS.teachersAccess);
      if (existingT?.rows.some(r => r[2].toLowerCase() === normalized)) {
        console.warn("[Registry] Teacher already in access list:", normalized);
      } else {
        const accessRow = [submission[0], submission[1], normalized, submission[6]];
        await mfsAppendCSVRow(MFS.teachersAccess, TEACHER_ACCESS_HEADERS, accessRow);
      }
  }
}

/** Check if a student wallet is in the /Access/students.csv */
export async function isStudentApproved(walletAddress: string): Promise<boolean> {
  // 1. Admin Bypass: Admin can see student page
  const { isAdminAddress } = await import('@/config/env');
  if (isAdminAddress(walletAddress)) return true;

  const data = await mfsReadCSV(STUDENT_ACCESS_PATH);
  if (!data) return false;
  return data.rows.some(r => r[2].toLowerCase() === walletAddress.toLowerCase() && r[4] === 'active');
}

/** Revoke access by deleting record from IPFS security registries */
export async function revokeStudentAccess(walletAddress: string): Promise<void> {
  const normalized = walletAddress.toLowerCase();
  
  // 1. Delete from /Access/students.csv (Main)
  const data1 = await mfsReadCSV(STUDENT_ACCESS_PATH);
  if (data1) {
    const updated = data1.rows.filter(r => r[2]?.toLowerCase() !== normalized);
    const headers = ['Id', 'Name', 'WalletAddress', 'TeacherName', 'Status', 'University'];
    await mfsWriteCSV(STUDENT_ACCESS_PATH, headers, updated);
  }

  // 2. Delete from /Access/StudentsAccess.csv (Legacy/Legacy redundant)
  const legacyPath = '/Access/StudentsAccess.csv';
  const data2 = await mfsReadCSV(legacyPath);
  if (data2) {
    const updatedLegacy = data2.rows.filter(r => r[2]?.toLowerCase() !== normalized);
    await mfsWriteCSV(legacyPath, data2.headers, updatedLegacy);
  }
}

// ── Teacher Access (for TEACHER_FLAG=1 auth) ─────────────────────────────────

export async function isTeacherApproved(walletAddress: string): Promise<boolean> {
  // 1. Admin Bypass: Admin can see instructor page
  const { isAdminAddress } = await import('@/config/env');
  if (isAdminAddress(walletAddress)) return true;

  const data = await mfsReadCSV(MFS.teachersAccess);
  if (!data) return false;
  return data.rows.some(r => r[2]?.toLowerCase() === walletAddress.toLowerCase());
}

export async function getTeacherNameByWallet(walletAddress: string): Promise<string | null> {
  const data = await mfsReadCSV(MFS.teachersAccess);
  if (!data) return null;
  const row = data.rows.find(r => r[2]?.toLowerCase() === walletAddress.toLowerCase());
  return row ? row[1] : null;
}

export async function getTeacherInfo(walletAddress: string): Promise<{ name: string; university: string; department: string } | null> {
  // TeachersAccess gives us the name and confirms they are active
  const data = await mfsReadCSV(MFS.teachersAccess);
  if (!data) return null;
  const row = data.rows.find(r => r[2]?.toLowerCase() === walletAddress.toLowerCase());
  if (!row) return null; // Not an active teacher
  
  let university = 'ChainEdu University';
  let department = 'General';

  // Submissions contains the full registration details (university, department)
  try {
    const submissionsData = await mfsReadCSV(MFS.submissions);
    if (submissionsData) {
      // Find the most recent teacher application for this wallet
      const subRow = submissionsData.rows.slice().reverse().find(r => 
        (r[2] === 'Teacher' || r[2] === 'TEACHER') && 
        r[5]?.toLowerCase() === walletAddress.toLowerCase()
      );
      if (subRow) {
        university = subRow[3] || university;
        department = subRow[4] || department;
      }
    }
  } catch (e) {
    console.warn('[getTeacherInfo] Could not read submissions for extended info');
  }

  return { name: row[1], university, department };
}

export async function getPendingTeacherStudents(teacherWallet: string): Promise<{ name: string; walletAddress: string; teacherName: string }[]> {
  const data = await mfsReadCSV('/Registrations/Submissions.csv');
  if (!data) return [];
  // Headers: Id, Name, Role, University, Department, WalletAddress, UniqueLinkId, Status, TeacherIdentifier
  const teacherAddr = teacherWallet.toLowerCase();
  const tInfo = await getTeacherInfo(teacherWallet);
  const teacherName = tInfo?.name?.toLowerCase();

  return data.rows
    .filter(r => (r[2]?.toUpperCase() === 'STUDENT') && r[7] === 'pending')
    .filter(r => {
      const matchAddr = r[8]?.toLowerCase() === teacherAddr;
      const matchName = teacherName && r[8]?.toLowerCase() === teacherName; // Legacy match
      return matchAddr || matchName;
    })
    .map(r => ({ name: r[1], walletAddress: r[5], teacherName: r[8] }));
}

// ── Template Downloaders ──────────────────────────────────────────────────────

export function downloadTemplate(type: 'question' | 'answer') {
  const content = type === 'question'
    ? `${QUESTION_PAPER_TEMPLATE_HEADERS}\n"What is blockchain?",Ledger,Chain,Database,None,1,5\n"What does IPFS stand for?","InterPlanetary File System","International Protocol","Internet File Storage","IP Fast System",1,10`
    : `${ANSWER_KEY_TEMPLATE_HEADERS}\n1,1\n2,3`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}_paper_template.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── CSV Parsing Helpers ───────────────────────────────────────────────────────

export function parseCSVText(text: string): string[][] {
  const result: string[][] = [];
  if (!text) return result;

  // Strip UTF-8 BOM if present
  let cleanText = text.replace(/^\uFEFF/, '');
  if (cleanText.trim().length === 0) return result;

  // auto-detect delimiter: check first line for , or ;
  const firstLine = cleanText.split('\n')[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : ',';

  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const next = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        row.push(cell.trim());
        cell = '';
      } else if (char === '\n' || (char === '\r' && next === '\n')) {
        if (char === '\r') i++; 
        row.push(cell.trim());
        result.push(row);
        row = [];
        cell = '';
      } else if (char !== '\r') {
        cell += char;
      }
    }
  }

  if (cell || row.length > 0) {
    row.push(cell.trim());
    result.push(row);
  }

  // Filter out completely empty rows
  return result.filter(r => r.length > 0 && r.some(c => c.length > 0));
}

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
