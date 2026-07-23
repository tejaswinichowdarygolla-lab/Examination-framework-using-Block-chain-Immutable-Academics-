import { v4 as uuidv4 } from 'uuid';
import { 
  mfsWriteCSV, 
  mfsReadCSV, 
  mfsAppendCSVRow, 
  mfsDeleteCSVRow,
  mfsWriteJSON,
  MFS 
} from './mfs';

export type Role = 'Teacher' | 'Student';

export const REG_HEADERS = ['UniqueLinkId', 'Role', 'CreatedAt', 'CreatedBy', 'University', 'Department', 'Status'];
export const TEACHER_ACCESS_HEADERS = ['Id', 'Name', 'WalletAddress', 'UniqueLinkId'];
export const STUDENT_ACCESS_HEADERS = ['Id', 'Name', 'WalletAddress', 'UniqueLinkId'];
export const AUDIT_HEADERS = ['Timestamp', 'Action', 'Category', 'User', 'Details'];

export interface RegistrationLink {
  linkId: string;
  role: Role;
  createdAt: number;
  createdBy: string;
  university: string;
  department: string;
  status: 'active' | 'stopped' | 'deleted';
}

export async function generateRegistrationLink(
  role: Role,
  adminAddress: string,
  university: string,
  department: string,
): Promise<{ linkId: string; url: string }> {
  const linkId = uuidv4();
  const now = Date.now();
  
  const row = [
    linkId,
    role,
    now.toString(),
    adminAddress.toLowerCase(),
    university,
    department,
    'active'
  ];

  await mfsAppendCSVRow(MFS.registrations, REG_HEADERS, row);
  
  // Log Audit
  await logAudit('GENERATE_LINK', 'ADMIN', adminAddress, `Link generated for ${role} in ${university}`);

  const url = `${window.location.origin}/register/${linkId}`;
  return { linkId, url };
}

export async function logAudit(action: string, category: string, user: string, details: string) {
  try {
    const row = [Date.now().toString(), action, category, user, details];
    await mfsAppendCSVRow(MFS.audit, AUDIT_HEADERS, row);
  } catch (e) {
    console.error('[Audit] Log failed', e);
  }
}

export async function isStudentApproved(walletAddress: string): Promise<boolean> {
  // Admin is always student-approved for testing
  const { isAdminAddress } = await import('@/config/env');
  if (isAdminAddress(walletAddress)) return true;

  const data = await mfsReadCSV(MFS.studentsAccess);
  if (!data) return false;
  return data.rows.some(r => r[2].toLowerCase() === walletAddress.toLowerCase());
}

export async function isTeacherApproved(walletAddress: string): Promise<boolean> {
  // Admin is always teacher-approved for testing
  const { isAdminAddress } = await import('@/config/env');
  if (isAdminAddress(walletAddress)) return true;

  const data = await mfsReadCSV(MFS.teachersAccess);
  if (!data) return false;
  return data.rows.some(r => r[2]?.toLowerCase() === walletAddress.toLowerCase());
}

export async function getAllLinks(viewerAddress?: string): Promise<RegistrationLink[]> {
  const data = await mfsReadCSV(MFS.registrations);
  if (!data) return [];
  
  const { isAdminAddress } = await import('@/config/env');
  const isSysAdmin = viewerAddress ? isAdminAddress(viewerAddress) : false;

  return data.rows.map(row => ({
    linkId: row[0],
    role: row[1] as Role,
    createdAt: parseInt(row[2]),
    createdBy: row[3],
    university: row[4],
    department: row[5],
    status: row[6] as 'active' | 'stopped' | 'deleted'
  })).filter(l => l.status !== 'deleted' && (isSysAdmin || !viewerAddress || l.createdBy.toLowerCase() === viewerAddress.toLowerCase()));
}

export async function toggleLinkStatus(linkId: string, status: 'active' | 'stopped'): Promise<void> {
  const data = await mfsReadCSV(MFS.registrations);
  if (data) {
    const updatedRows = data.rows.map(r => {
      const row = [...r];
      if (row[0] === linkId) row[6] = status;
      return row;
    });
    await mfsWriteCSV(MFS.registrations, REG_HEADERS, updatedRows);
  }
}

export async function deleteLink(linkId: string): Promise<void> {
  // Mark as deleted in Registrations.csv
  const data = await mfsReadCSV(MFS.registrations);
  if (data) {
    const updatedRows = data.rows.map(r => {
      if (r[0] === linkId) r[6] = 'deleted';
      return r;
    });
    await mfsWriteCSV(MFS.registrations, REG_HEADERS, updatedRows);
  }

  // Delete from access files if existed? 
  // Client said: "When the link of registration is deleted, then delete the respective data in the csv file in the IPFS node."
  await mfsDeleteCSVRow(MFS.teachersAccess, 3, linkId);
  await mfsDeleteCSVRow(MFS.studentsAccess, 3, linkId);
}

export interface TeacherRegistration {
  name: string;
  role: 'Teacher';
  university: string;
  department: string;
  walletAddress: string;
  linkId: string;
}

let failedAttemptsCount = 0;
let lastAttemptTime = 0;
const MAX_FAILED_ATTEMPTS = 5;
const COOLDOWN_PERIOD = 60 * 1000; // 1 minute

export async function verifyLinkIsActive(linkId: string): Promise<boolean> {
  const now = Date.now();
  if (failedAttemptsCount >= MAX_FAILED_ATTEMPTS && (now - lastAttemptTime) < COOLDOWN_PERIOD) {
    const waitSeconds = Math.ceil((COOLDOWN_PERIOD - (now - lastAttemptTime)) / 1000);
    throw new Error(`Too many failed attempts. Please try again in ${waitSeconds} seconds.`);
  }

  const data = await mfsReadCSV(MFS.registrations);
  if (!data) return false;
  const linkRow = data.rows.find(r => r[0] === linkId);
  
  if (!linkRow || linkRow[6] !== 'active') {
    failedAttemptsCount++;
    lastAttemptTime = now;
    return false;
  }
  
  // Successful link check resets failure counter
  failedAttemptsCount = 0;
  return true;
}

export async function registerTeacher(data: TeacherRegistration): Promise<void> {
  // SEC-TC-003 Link Validation
  const isActive = await verifyLinkIsActive(data.linkId);
  if (!isActive) {
    throw new Error('This registration link is no longer active.');
  }

  // Deduplication Check
  const submissions = await mfsReadCSV('/Registrations/Submissions.csv');
  const normalized = data.walletAddress.toLowerCase();
  
  if (submissions?.rows.some(r => r[5].toLowerCase() === normalized && r[7] !== 'rejected')) {
    throw new Error('This wallet address is already registered or pending approval.');
  }

  const access = await mfsReadCSV(MFS.teachersAccess);
  if (access?.rows.some(r => r[2].toLowerCase() === normalized)) {
    throw new Error('This wallet address is already an approved teacher.');
  }

  const submissionHeaders = ['Id', 'Name', 'Role', 'University', 'Department', 'WalletAddress', 'UniqueLinkId', 'Status'];
  const submissionRow = [
    uuidv4(),
    data.name,
    'Teacher',
    data.university,
    data.department,
    normalized,
    data.linkId,
    'pending'
  ];
  
  await mfsAppendCSVRow('/Registrations/Submissions.csv', submissionHeaders, submissionRow);
}

export async function getPendingSubmissions(viewerAddress?: string): Promise<any[]> {
  const data = await mfsReadCSV('/Registrations/Submissions.csv');
  if (!data) return [];
  
  const { ENV, isAdminAddress } = await import('@/config/env');
  const isSysAdmin = viewerAddress ? isAdminAddress(viewerAddress) : false;

  return data.rows
    .filter(r => {
      const isPending = r[7] === 'pending';
      const isTeacher = r[2] === 'Teacher' || r[2] === 'TEACHER';
      const isStudent = r[2] === 'Student' || r[2] === 'STUDENT';
      
      // TC-001: Removed specific admin wallet filtering to prevent leakage.
      // Logic now relies on general system admin role for visibility.
      if (isTeacher && isPending) return true;
      if (isStudent && isPending && isSysAdmin) return true;
      return false;
    })
    .map(r => ({
      id: r[0],
      name: r[1],
      role: r[2],
      university: r[3],
      department: r[4],
      walletAddress: r[5],
      linkId: r[6]
    }));
}

export async function approveUser(id: string, status: 'approved' | 'rejected' = 'approved'): Promise<void> {
  const data = await mfsReadCSV('/Registrations/Submissions.csv');
  if (!data) return;
  
  const headers = ['Id', 'Name', 'Role', 'University', 'Department', 'WalletAddress', 'UniqueLinkId', 'Status'];
  const submission = data.rows.find(r => r[0] === id);
  if (!submission) return;

  // Update status in Submissions.csv
  const updatedRows = data.rows.map(r => {
    const row = [...r];
    if (row[0] === id) row[7] = status;
    return row;
  });
  await mfsWriteCSV('/Registrations/Submissions.csv', headers, updatedRows);

  // ONLY add to access list if APPROVED
  if (status === 'approved') {
    if (submission[2] === 'Teacher' || submission[2] === 'TEACHER') {
      const accessRow = [
        submission[0],
        submission[1],
        submission[5],
        submission[6]
      ];
      await mfsAppendCSVRow(MFS.teachersAccess, TEACHER_ACCESS_HEADERS, accessRow);
    }
    if (submission[2] === 'Student' || submission[2] === 'STUDENT') {
      const { grantStudentAccess } = await import('@/utils/examUtils');
      // Pass the row which has [Id, Name, Role, Univ, Dept, Wallet, LinkId, Status, TeacherAddr]
      await grantStudentAccess(submission);
      
      // Also ensure they are in teacher's Registry file
      const { addStudentToTeacherRegistry, getTeacherNameByWallet } = await import('@/utils/examUtils');
      const teacherAddr = submission[8] || submission[7]; // Fallback to last if header shifted
      const teacherName = await getTeacherNameByWallet(teacherAddr) || 'Admin_Approved';
      await addStudentToTeacherRegistry(teacherName, { name: submission[1], walletAddress: submission[5] }, 'approved').catch(() => {});
    }
    
    // Log Audit Approval
    await logAudit('APPROVE_USER', 'AUTH', 'ADMIN', `Approved ${submission[2]} ${submission[1]} (${submission[5]})`);
  } else {
    // Log Audit Rejection
    await logAudit('REJECT_USER', 'AUTH', 'ADMIN', `Rejected ${submission[2]} ${submission[1]} (${submission[5]})`);
  }
}

export async function registerStudent(data: { name: string, walletAddress: string, teacherName: string, linkId: string, teacherId?: string, university?: string, department?: string }): Promise<void> {
  // SEC-TC-003 Link Validation
  const isActive = await verifyLinkIsActive(data.linkId);
  if (!isActive) {
    throw new Error('This registration link is no longer active or invalid.');
  }

  const normalized = data.walletAddress.toLowerCase();

  // Deduplication Check
  const submissions = await mfsReadCSV('/Registrations/Submissions.csv');
  if (submissions?.rows.some(r => r[5].toLowerCase() === normalized && r[7] !== 'rejected')) {
    throw new Error('This wallet address is already registered or pending approval.');
  }

  const access = await mfsReadCSV('/Access/students.csv');
  if (access?.rows.some(r => r[2].toLowerCase() === normalized)) {
    throw new Error('This wallet address is already an approved student.');
  }

  // 1. Add to teacher's specific list
  const headers = ['Name', 'WalletAddress', 'TeacherName', 'LinksId', 'Status'];
  const row = [data.name, normalized, data.teacherName, data.linkId, 'pending'];
  await mfsAppendCSVRow(MFS.teacherStudentList(data.teacherName), headers, row);
  
  // 2. Add to global submissions for admin/teacher approval visibility
  const submissionHeaders = ['Id', 'Name', 'Role', 'University', 'Department', 'WalletAddress', 'UniqueLinkId', 'Status', 'TeacherIdentifier'];
  const submissionRow = [
    uuidv4(), 
    data.name, 
    'Student', 
    data.university || 'ChainEdu University', 
    data.department || 'General', 
    normalized, 
    data.linkId, 
    'pending',
    data.teacherId?.toLowerCase() || normalized // Use Teacher Address as identifier
  ];
  await mfsAppendCSVRow('/Registrations/Submissions.csv', submissionHeaders, submissionRow);
}

export async function scheduleExam(uni: string, teacher: string, examName: string, startTime: string, endTime: string): Promise<void> {
  const headers = ['TeacherName', 'ExamName', 'StartTime', 'EndTime'];
  const row = [teacher, examName, startTime, endTime];
  await mfsAppendCSVRow(MFS.examSchedule(uni, teacher), headers, row);
  await logAudit('SCHEDULE_EXAM', 'EXAM', teacher, `Scheduled ${examName} for ${uni}`);
}

// "Parquet" Simulator
export async function uploadQuestionPaper(uni: string, teacher: string, examName: string, data: any[]): Promise<void> {
  const path = MFS.questionPaper(uni, teacher, examName);
  // Simulate compression by writing a non-human readable string or just JSON for dev
  await mfsWriteJSON(path, { data, compressed: true, format: 'parquet' });
  await logAudit('UPLOAD_PAPER', 'EXAM', teacher, `Uploaded paper for ${examName} in ${uni}`);
}
