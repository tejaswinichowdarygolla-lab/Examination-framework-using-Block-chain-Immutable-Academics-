import { mfsWriteJSON, mfsReadJSON, mfsList } from './mfs';
import { MFS } from './mfs';

export type LogLevel = 'info' | 'warning' | 'error' | 'critical';
export type LogCategory =
  | 'exam_upload'
  | 'exam_start'
  | 'exam_submit'
  | 'exam_restart'
  | 'answer_update'
  | 'role_change'
  | 'registration'
  | 'network_loss'
  | 'result_update'
  | 'general';

export interface LogEntry {
  timestamp: number;
  category: LogCategory;
  level: LogLevel;
  actor: string;
  subject: string;
  message: string;
  metadata?: Record<string, unknown>;
  isResultLog: boolean;
  createdAt: number;
}

const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

async function writeLog(path: string, entry: LogEntry): Promise<void> {
  await mfsWriteJSON(path, entry);
}

export async function logTeacherAction(
  teacherAddr: string,
  category: LogCategory,
  message: string,
  metadata?: Record<string, unknown>,
  isResultLog = false,
): Promise<void> {
  const ts = Date.now();
  const entry: LogEntry = {
    timestamp: ts,
    category,
    level: isResultLog ? 'critical' : 'info',
    actor: teacherAddr.toLowerCase(),
    subject: teacherAddr.toLowerCase(),
    message,
    metadata,
    isResultLog,
    createdAt: ts,
  };
  await writeLog(MFS.teacherLog(teacherAddr, ts), entry);
}

export async function logExamEvent(
  teacherAddr: string,
  examId: string,
  category: LogCategory,
  message: string,
  metadata?: Record<string, unknown>,
  isResultLog = false,
): Promise<void> {
  const ts = Date.now();
  const entry: LogEntry = {
    timestamp: ts,
    category,
    level: isResultLog ? 'critical' : 'info',
    actor: teacherAddr.toLowerCase(),
    subject: examId,
    message,
    metadata,
    isResultLog,
    createdAt: ts,
  };
  await writeLog(MFS.examLog(teacherAddr, examId, ts), entry);
}

export async function logStudentAction(
  studentAddr: string,
  category: LogCategory,
  message: string,
  metadata?: Record<string, unknown>,
  isResultLog = false,
): Promise<void> {
  const ts = Date.now();
  const entry: LogEntry = {
    timestamp: ts,
    category,
    level: isResultLog ? 'critical' : 'info',
    actor: studentAddr.toLowerCase(),
    subject: studentAddr.toLowerCase(),
    message,
    metadata,
    isResultLog,
    createdAt: ts,
  };
  await writeLog(MFS.studentLog(studentAddr, ts), entry);
}

export async function getTeacherLogs(teacherAddr: string): Promise<LogEntry[]> {
  const addr = teacherAddr.toLowerCase();
  const basePath = `/chainedu/teachers/${addr}/logs`;
  const files = await mfsList(basePath);
  const logs: LogEntry[] = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const ts = parseInt(f.replace('.json', ''), 10);
    const entry = await mfsReadJSON<LogEntry>(MFS.teacherLog(addr, ts));
    if (entry) logs.push(entry);
  }
  return logs.sort((a, b) => b.timestamp - a.timestamp);
}

export async function getExamLogs(
  teacherAddr: string,
  examId: string,
): Promise<LogEntry[]> {
  const addr = teacherAddr.toLowerCase();
  const basePath = `/chainedu/teachers/${addr}/exams/${examId}/logs`;
  const files = await mfsList(basePath);
  const logs: LogEntry[] = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const ts = parseInt(f.replace('.json', ''), 10);
    const entry = await mfsReadJSON<LogEntry>(MFS.examLog(addr, examId, ts));
    if (entry) logs.push(entry);
  }
  return logs.sort((a, b) => b.timestamp - a.timestamp);
}

export async function getStudentLogs(studentAddr: string): Promise<LogEntry[]> {
  const addr = studentAddr.toLowerCase();
  const basePath = `/chainedu/students/${addr}/logs`;
  const files = await mfsList(basePath);
  const logs: LogEntry[] = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const ts = parseInt(f.replace('.json', ''), 10);
    const entry = await mfsReadJSON<LogEntry>(MFS.studentLog(addr, ts));
    if (entry) logs.push(entry);
  }
  return logs.sort((a, b) => b.timestamp - a.timestamp);
}

import { mfsRemove } from './mfs';

export async function runLogExpiryCleanup(): Promise<{
  scanned: number;
  deleted: number;
}> {
  const cutoff = Date.now() - TWO_YEARS_MS;
  let scanned = 0;
  let deleted = 0;

  async function cleanDir(basePath: string, pathBuilder: (ts: number) => string) {
    const files = await mfsList(basePath);
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const ts = parseInt(f.replace('.json', ''), 10);
      if (isNaN(ts)) continue;
      scanned++;
      if (ts < cutoff) {
        const entry = await mfsReadJSON<LogEntry>(pathBuilder(ts));
        if (entry && !entry.isResultLog) {
          await mfsRemove(pathBuilder(ts));
          deleted++;
        }
      }
    }
  }

  try {
    const teacherDirs = await mfsList('/chainedu/teachers');
    for (const tDir of teacherDirs) {
      const addr = tDir;
      await cleanDir(
        `/chainedu/teachers/${addr}/logs`,
        (ts) => MFS.teacherLog(addr, ts),
      );
      const examDirs = await mfsList(`/chainedu/teachers/${addr}/exams`);
      for (const examId of examDirs) {
        await cleanDir(
          `/chainedu/teachers/${addr}/exams/${examId}/logs`,
          (ts) => MFS.examLog(addr, examId, ts),
        );
      }
    }

    const studentDirs = await mfsList('/chainedu/students');
    for (const sDir of studentDirs) {
      const addr = sDir;
      await cleanDir(
        `/chainedu/students/${addr}/logs`,
        (ts) => MFS.studentLog(addr, ts),
      );
    }
  } catch (err) {
    console.warn('[LogManager] Expiry cleanup scan error:', err);
  }
  
  return { scanned, deleted };
}

