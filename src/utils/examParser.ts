/**
 * src/utils/examParser.ts
 *
 * Parse and validate the teacher question paper CSV.
 *
 * Required columns (exact header names):
 *   Question, Option1, Option2, Option3, Option4, Correct_Option
 *
 * Correct_Option must be one of: Option1, Option2, Option3, Option4
 * Any deviation → reject with descriptive error.
 *
 * Also exports helpers for comparing papers (Phase 4 — answer update validation).
 */

import Papa from 'papaparse';

// ─── Types ───────────────────────────────────────────────────

export interface QuestionRow {
  question: string;
  option1: string;
  option2: string;
  option3: string;
  option4: string;
  correctOption: 'Option1' | 'Option2' | 'Option3' | 'Option4';
}

export interface ParseResult {
  ok: boolean;
  questions?: QuestionRow[];
  error?: string;
}

// ─── Required headers ────────────────────────────────────────
const REQUIRED_HEADERS = [
  'Question',
  'Option1',
  'Option2',
  'Option3',
  'Option4',
  'Correct_Option',
] as const;

const VALID_CORRECT = new Set(['Option1', 'Option2', 'Option3', 'Option4']);

// ─── Parser ──────────────────────────────────────────────────

export function parseExamCSV(csvText: string): ParseResult {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  });

  if (result.errors.length > 0) {
    return { ok: false, error: `CSV parse error: ${result.errors[0].message}` };
  }

  // Check headers
  const actualHeaders = result.meta.fields ?? [];
  const missingHeaders = REQUIRED_HEADERS.filter((h) => !actualHeaders.includes(h));
  if (missingHeaders.length > 0) {
    return {
      ok: false,
      error: `Missing required columns: ${missingHeaders.join(', ')}. ` +
        `Required: Question, Option1, Option2, Option3, Option4, Correct_Option`,
    };
  }

  const questions: QuestionRow[] = [];
  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i];
    const rowNum = i + 2; // 1-indexed + header row

    if (!row['Question'] || !row['Option1'] || !row['Option2'] || !row['Option3'] || !row['Option4']) {
      return { ok: false, error: `Row ${rowNum}: Question or options cannot be empty` };
    }

    const correct = row['Correct_Option'];
    if (!VALID_CORRECT.has(correct)) {
      return {
        ok: false,
        error: `Row ${rowNum}: Correct_Option must be one of Option1, Option2, Option3, Option4. Got: "${correct}"`,
      };
    }

    questions.push({
      question: row['Question'],
      option1: row['Option1'],
      option2: row['Option2'],
      option3: row['Option3'],
      option4: row['Option4'],
      correctOption: correct as QuestionRow['correctOption'],
    });
  }

  if (questions.length === 0) {
    return { ok: false, error: 'CSV contains no question rows' };
  }

  return { ok: true, questions };
}

// ─── Parse student list CSV ──────────────────────────────────
// Column: "Student_List" containing wallet addresses + optional "Stu_mail"

export interface StudentListRow {
  address: string;
  email?: string;
}

export interface StudentListParseResult {
  ok: boolean;
  students?: StudentListRow[];
  error?: string;
}

export function parseStudentListCSV(csvText: string): StudentListParseResult {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  });

  if (result.errors.length > 0) {
    return { ok: false, error: `CSV parse error: ${result.errors[0].message}` };
  }

  const fields = result.meta.fields ?? [];
  if (!fields.includes('Student_List')) {
    return {
      ok: false,
      error: 'Missing required column: "Student_List". Header must be exactly "Student_List".',
    };
  }

  const students: StudentListRow[] = [];
  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i];
    const address = row['Student_List'];
    if (!address) continue;
    if (!address.startsWith('0x') || address.length !== 42) {
      return {
        ok: false,
        error: `Row ${i + 2}: Invalid Ethereum address format: "${address}"`,
      };
    }
    const item: StudentListRow = { address: address.toLowerCase() };
    if (fields.includes('Stu_mail') && row['Stu_mail']) {
      item.email = row['Stu_mail'].toLowerCase();
    }
    students.push(item);
  }

  if (students.length === 0) {
    return { ok: false, error: 'CSV contains no student addresses' };
  }

  return { ok: true, students };
}

// ─── Answer update validation ─────────────────────────────────
/**
 * Compare a new paper against the stored paper.
 * Rules:
 * - Questions must be identical (same text)
 * - Options must be identical (same text and order)
 * - Only Correct_Option may differ → triggers re-evaluation and fee
 * - If papers are not structurally identical → reject with reason
 * - If answers are same → no-op
 */
export type UpdateCheckResult =
  | { outcome: 'identical' }
  | { outcome: 'answers_changed'; changedRows: number[] }
  | { outcome: 'structure_mismatch'; reason: string };

export function compareExamPapers(
  existing: QuestionRow[],
  incoming: QuestionRow[],
): UpdateCheckResult {
  if (existing.length !== incoming.length) {
    return {
      outcome: 'structure_mismatch',
      reason: `Question count differs: existing has ${existing.length}, incoming has ${incoming.length}`,
    };
  }

  const changedRows: number[] = [];

  for (let i = 0; i < existing.length; i++) {
    const e = existing[i];
    const n = incoming[i];

    if (e.question !== n.question) {
      return {
        outcome: 'structure_mismatch',
        reason: `Question text changed at row ${i + 1}. Questions must stay identical.`,
      };
    }
    if (e.option1 !== n.option1 || e.option2 !== n.option2 ||
        e.option3 !== n.option3 || e.option4 !== n.option4) {
      return {
        outcome: 'structure_mismatch',
        reason: `Option text changed at row ${i + 1}. Options must stay identical.`,
      };
    }
    if (e.correctOption !== n.correctOption) {
      changedRows.push(i + 1);
    }
  }

  if (changedRows.length === 0) return { outcome: 'identical' };
  return { outcome: 'answers_changed', changedRows };
}

// ─── Answer-only paper (for encryption/storage) ──────────────
/** Extract only the answer key (row index → correctOption) */
export function extractAnswerKey(
  questions: QuestionRow[],
): Record<number, QuestionRow['correctOption']> {
  const key: Record<number, QuestionRow['correctOption']> = {};
  questions.forEach((q, i) => {
    key[i] = q.correctOption;
  });
  return key;
}

/** Strip answers out of question rows (safe to show students) */
export function stripAnswers(questions: QuestionRow[]): Omit<QuestionRow, 'correctOption'>[] {
  return questions.map(({ correctOption: _co, ...rest }) => rest);
}
