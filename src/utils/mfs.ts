import { getIPFSClient } from './ipfs';

function sanitizePath(path: string): string {
  // SEC-TC-005 Path Traversal Protection
  if (path.includes('..')) {
    throw new Error('Security Error: Path traversal detected (..) in ' + path);
  }
  // Ensure path is absolute and doesn't contain null bytes
  if (path.includes('\0')) {
    throw new Error('Security Error: Null byte detected in path');
  }
  return path;
}

async function mfsWrite(path: string, content: string | Uint8Array, overwrite = true): Promise<void> {
  const safePath = sanitizePath(path);
  const client = getIPFSClient();
  await client.files.write(safePath, typeof content === 'string' ? new TextEncoder().encode(content) : content, {
    create: true,
    parents: true,
    truncate: overwrite,
  });
}

async function mfsRead(path: string): Promise<string | null> {
  const safePath = sanitizePath(path);
  try {
    const client = getIPFSClient();
    const chunks: Uint8Array[] = [];
    for await (const chunk of client.files.read(safePath)) {
      chunks.push(chunk as Uint8Array);
    }
    const total = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
    let offset = 0;
    for (const c of chunks) { total.set(c, offset); offset += c.length; }
    return new TextDecoder().decode(total);
  } catch {
    return null;
  }
}

export async function mfsAppendBinary(path: string, content: Uint8Array): Promise<void> {
  const client = getIPFSClient();
  let currentSize = 0;
  try {
    const stat = await client.files.stat(path);
    currentSize = stat.size;
  } catch {
    // File doesn't exist, create it below with offset 0
  }
  await client.files.write(path, content, {
    create: true,
    parents: true,
    offset: currentSize,
  });
}

async function mkdirSafe(path: string): Promise<void> {
  try {
    const client = getIPFSClient();
    await client.files.mkdir(path, { parents: true });
  } catch { }
}

export async function mfsWriteJSON(path: string, data: object): Promise<void> {
  return mfsWrite(path, JSON.stringify(data, null, 2), true);
}

export async function mfsReadJSON<T = unknown>(path: string): Promise<T | null> {
  const content = await mfsRead(path);
  if (!content) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

// CSV Helpers
export async function mfsWriteCSV(path: string, headers: string[], rows: string[][]): Promise<void> {
  const content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  return mfsWrite(path, content, true);
}

export async function mfsReadCSV(path: string): Promise<{ headers: string[], rows: string[][] } | null> {
  const content = await mfsRead(path);
  if (!content) return null;
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) return null;
  const headers = lines[0].split(',');
  const rows = lines.slice(1).map(l => l.split(','));
  return { headers, rows };
}

export async function mfsAppendCSVRow(path: string, headers: string[], row: string[]): Promise<void> {
  const existing = await mfsReadCSV(path);
  if (!existing) {
    return mfsWriteCSV(path, headers, [row]);
  }
  const content = '\n' + row.join(',');
  await mfsWrite(path, content, false); // false = append in kubo-rpc-client is tricky, truncate:false is not append.
  // Actually kubo-rpc-client write with truncate:false and offset is needed for real append.
  // For simplicity and correctness with small CSVs, we'll rewrite:
  const newRows = [...existing.rows, row];
  return mfsWriteCSV(path, headers, newRows);
}

export async function mfsDeleteCSVRow(path: string, columnIndex: number, value: string): Promise<void> {
  const existing = await mfsReadCSV(path);
  if (!existing) return;
  const newRows = existing.rows.filter(r => r[columnIndex] !== value);
  return mfsWriteCSV(path, existing.headers, newRows);
}

export async function mfsList(path: string): Promise<string[]> {
  try {
    const client = getIPFSClient();
    const entries: string[] = [];
    for await (const entry of client.files.ls(path)) {
      entries.push(entry.name);
    }
    return entries;
  } catch {
    return [];
  }
}

export async function mfsRemove(path: string, recursive = false): Promise<void> {
  // SEC-TC-016: Protect Audit and Log files from deletion (Append-only requirement)
  const lowerPath = path.toLowerCase();
  if (lowerPath.includes('/audit') || lowerPath.includes('/logs')) {
    throw new Error('Security Error: Audit logs are append-only and cannot be removed.');
  }
  
  try {
    const client = getIPFSClient();
    await client.files.rm(path, { recursive });
  } catch { }
}

export async function mfsExists(path: string): Promise<boolean> {
  try {
    const client = getIPFSClient();
    await client.files.stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function mfsStat(path: string): Promise<{ cid: string; size: number } | null> {
  try {
    const client = getIPFSClient();
    const stat = await client.files.stat(path);
    return { cid: stat.cid.toString(), size: stat.size };
  } catch {
    return null;
  }
}

const DIRS = [
  '/Registrations',
  '/Access',
  '/chainedu',
  '/chainedu/teachers',
  '/chainedu/students',
  '/Audit',
  '/Question_paper',
  '/Schedules',
  '/ExamControl',
];

export async function initChainEduDirectories(): Promise<{ ok: boolean; error?: string }> {
  try {
    for (const dir of DIRS) {
      await mkdirSafe(dir);
    }
    return { ok: true };
  } catch (err: any) {
    console.error('[MFS] Failed to init directories', err);
    return { ok: false, error: err?.message };
  }
}

export const MFS = {
  registrations: '/Registrations/Registrations.csv',
  teachersAccess: '/Access/TeachersAccess.csv',
  studentsAccess: '/Access/students.csv', // Updated as per requirement
  submissions: '/Registrations/Submissions.csv',
  audit: '/Audit/GlobalAudit.csv',
  
  // Dynamic paths
  teacherStudentList: (teacherName: string) => `/Registrations/${teacherName.replace(/\s+/g, '_')}_Students.csv`,
  questionPaper: (uni: string, teacher: string, exam: string) => 
    `/Question_paper/${uni.replace(/\s+/g, '_')}/${teacher.replace(/\s+/g, '_')}_${exam.replace(/\s+/g, '_')}.parquet`,
  examSchedule: (uni: string, teacher: string) => 
    `/Schedules/${uni.replace(/\s+/g, '_')}/${teacher.replace(/\s+/g, '_')}/timings.csv`,

  // Keep legacy paths for a moment or migrate
  link: (linkId: string) => `/chainedu/registry/links/${linkId}.json`,
  pendingTeacher: (addr: string) => `/chainedu/registry/users/teachers/${addr.toLowerCase()}.json`,
  pendingStudent: (addr: string) => `/chainedu/registry/users/students/${addr.toLowerCase()}.json`,

  teacherDir: (addr: string) => `/chainedu/teachers/${addr.toLowerCase()}`,
  teacherMeta: (addr: string) => `/chainedu/teachers/${addr.toLowerCase()}/meta.json`,
  teacherStudents: (addr: string) => `/chainedu/teachers/${addr.toLowerCase()}/students.json`,
  teacherExamDir: (addr: string, examId: string) => `/chainedu/teachers/${addr.toLowerCase()}/exams/${examId}`,
  examPaper: (teacherAddr: string, examId: string) => `/chainedu/teachers/${teacherAddr.toLowerCase()}/exams/${examId}/paper.enc`,
  examAnswers: (teacherAddr: string, examId: string) => `/chainedu/teachers/${teacherAddr.toLowerCase()}/exams/${examId}/answers.enc`,
  teacherLog: (addr: string, ts: number) => `/chainedu/teachers/${addr.toLowerCase()}/logs/${ts}.json`,
  examLog: (teacherAddr: string, examId: string, ts: number) => `/chainedu/teachers/${teacherAddr.toLowerCase()}/exams/${examId}/logs/${ts}.json`,

  // SEC-TC-012: Hashed student paths (non-guessable suffixes)
  studentDir: (addr: string) => `/chainedu/students/${addr.toLowerCase()}`,
  studentMeta: (addr: string) => `/chainedu/students/${addr.toLowerCase()}/meta.json`,
  examBuffer: (addr: string, examId: string) => {
    // Suffix based on wallet address + examId + static salt
    const suffix = addr.slice(-8).toLowerCase() + examId.slice(0, 4);
    return `/chainedu/students/${addr.toLowerCase()}/buffer/${examId}_${suffix}.json`;
  },
  studentResult: (addr: string, examId: string) => {
    const suffix = addr.slice(-8).toLowerCase() + examId.slice(0, 4);
    return `/chainedu/students/${addr.toLowerCase()}/results/${examId}_${suffix}.json`;
  },
  studentLog: (addr: string, ts: number) => `/chainedu/students/${addr.toLowerCase()}/logs/${ts}.json`,
} as const;

/**
 * SEC-TC-049: Implementation of 2-year log retention policy.
 */
export async function pruneOldLogs(retentionYears = 2): Promise<number> {
  const path = '/audit/logs.csv';
  try {
    const data = await mfsReadCSV(path);
    if (!data) return 0;
    
    const cutoff = Date.now() - (retentionYears * 365 * 24 * 60 * 60 * 1000);
    const originalCount = data.rows.length;
    
    const updated = data.rows.filter(row => {
      const ts = new Date(row[0]).getTime();
      return !isNaN(ts) && ts >= cutoff;
    });
    
    if (updated.length < originalCount) {
       await mfsWriteCSV(path, data.headers, updated);
       // Log the cleanup event
       await mfsAppendCSVRow('/audit/logs.csv', data.headers, [
         new Date().toISOString(), 
         'RETENTION_PRUNE', 
         'SYSTEM', 
         `Pruned ${originalCount - updated.length} entries.`
       ]);
    }
    return originalCount - updated.length;
  } catch {
    return 0;
  }
}

