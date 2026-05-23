import * as XLSX from 'xlsx';
import { parseDateValue } from './timeUtils.js';

const MONTHS = [
  { index: 0, names: ['enero', 'ene', 'january', 'jan'] },
  { index: 1, names: ['febrero', 'feb', 'february'] },
  { index: 2, names: ['marzo', 'mar', 'march'] },
  { index: 3, names: ['abril', 'abr', 'april', 'apr'] },
  { index: 4, names: ['mayo', 'may'] },
  { index: 5, names: ['junio', 'jun', 'june'] },
  { index: 6, names: ['julio', 'jul', 'july'] },
  { index: 7, names: ['agosto', 'ago', 'august', 'aug'] },
  { index: 8, names: ['septiembre', 'setiembre', 'sep', 'september'] },
  { index: 9, names: ['octubre', 'oct', 'october'] },
  { index: 10, names: ['noviembre', 'nov', 'november'] },
  { index: 11, names: ['diciembre', 'dic', 'december', 'dec'] },
];

const CODE_HEADERS = [
  'CODIGO',
  'CODIGO EMPLEADO',
  'CODIGO DE EMPLEADO',
  'COD EMPLEADO',
  'COD',
  'ID',
  'ID EMPLEADO',
  'EMPLEADO',
];

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHeader(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeEmployeeCode(value = '') {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return '';
  return raw.replace(/\.0$/, '');
}

export function getEmployeeCodeKeys(value = '') {
  const normalized = normalizeEmployeeCode(value);
  if (!normalized) return [];

  const withoutLeadingZeros = normalized.replace(/^0+(?=\d)/, '');
  return Array.from(new Set([normalized, withoutLeadingZeros].filter(Boolean)));
}

export function detectEvaluationMonth(rows = [], mapping = {}) {
  const monthCounts = new Map();

  rows.forEach((row) => {
    const value = row?.[mapping.fecha];
    const parsedDate = parseDateValue(value);
    if (!parsedDate) return;

    const key = `${parsedDate.getFullYear()}-${parsedDate.getMonth()}`;
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  });

  const [bestKey] = Array.from(monthCounts.entries()).sort((a, b) => b[1] - a[1])[0] ?? [];
  if (!bestKey) return null;

  const [year, month] = bestKey.split('-').map(Number);
  return {
    year,
    month,
    label: `${MONTHS[month].names[0]} ${year}`,
  };
}

export function detectAvailableMonths(rows = [], mapping = {}) {
  const monthCounts = new Map();

  rows.forEach((row) => {
    const value = row?.[mapping.fecha];
    const parsedDate = parseDateValue(value);
    if (!parsedDate) return;

    const year = parsedDate.getFullYear();
    const month = parsedDate.getMonth();
    const key = `${year}-${month}`;
    const current = monthCounts.get(key) ?? {
      key,
      year,
      month,
      label: `${MONTHS[month].names[0]} ${year}`,
      rowCount: 0,
    };
    current.rowCount += 1;
    monthCounts.set(key, current);
  });

  return Array.from(monthCounts.values()).sort((a, b) => a.year - b.year || a.month - b.month);
}

export function filterRowsByEvaluationMonth(rows = [], mapping = {}, evaluationMonth = null) {
  if (!evaluationMonth) return rows;

  return rows.filter((row) => {
    const parsedDate = parseDateValue(row?.[mapping.fecha]);
    return (
      parsedDate &&
      parsedDate.getFullYear() === Number(evaluationMonth.year) &&
      parsedDate.getMonth() === Number(evaluationMonth.month)
    );
  });
}

function scoreSheetName(sheetName, evaluationMonth) {
  if (!evaluationMonth) return 0;

  const normalized = normalizeText(sheetName);
  const monthNumber = evaluationMonth.month + 1;
  const monthInfo = MONTHS[evaluationMonth.month];
  let score = 0;

  if (monthInfo.names.some((name) => normalized.includes(name))) score += 10;
  if (normalized.includes(String(evaluationMonth.year))) score += 4;

  const numericTokens = normalized.match(/\d+/g) ?? [];
  if (numericTokens.some((token) => Number(token) === monthNumber)) score += 6;
  if (numericTokens.some((token) => token.padStart(2, '0') === String(monthNumber).padStart(2, '0'))) {
    score += 3;
  }

  return score;
}

function chooseSheetName(workbook, evaluationMonth) {
  if (workbook.SheetNames.length === 1) {
    return { sheetName: workbook.SheetNames[0], matchedByMonth: false };
  }

  const ranked = workbook.SheetNames.map((sheetName) => ({
    sheetName,
    score: scoreSheetName(sheetName, evaluationMonth),
  })).sort((a, b) => b.score - a.score);

  if (ranked[0]?.score > 0) {
    return { sheetName: ranked[0].sheetName, matchedByMonth: true };
  }

  return { sheetName: workbook.SheetNames[0], matchedByMonth: false };
}

function findCodeHeader(rows = []) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const normalizedCodeHeaders = new Set(CODE_HEADERS.map(normalizeHeader));
  const exact = headers.find((header) => normalizedCodeHeaders.has(normalizeHeader(header)));
  if (exact) return exact;

  return headers.find((header) => normalizeHeader(header).includes('CODIGO')) ?? headers[0] ?? null;
}

export function parseExtendedScheduleWorkbook(arrayBuffer, fileName, evaluationMonth) {
  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: true,
    raw: false,
  });
  const selection = chooseSheetName(workbook, evaluationMonth);
  const worksheet = workbook.Sheets[selection.sheetName];
  const rows = worksheet
    ? XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false })
    : [];
  const codeHeader = findCodeHeader(rows);
  const codes = new Set();

  rows.forEach((row) => {
    getEmployeeCodeKeys(row?.[codeHeader]).forEach((code) => codes.add(code));
  });

  return {
    fileName,
    sheetName: selection.sheetName,
    matchedByMonth: selection.matchedByMonth,
    codeHeader,
    codes: Array.from(codes),
    rowCount: rows.length,
  };
}

export function parseExtendedScheduleFiles(files = [], rows = [], mapping = {}, evaluationMonthOverride = null) {
  const evaluationMonth = evaluationMonthOverride ?? detectEvaluationMonth(rows, mapping);
  const extendedEmployeeCodes = new Set();
  const filesMetadata = [];
  const warnings = [];

  files.forEach((file) => {
    const parsed = parseExtendedScheduleWorkbook(file.arrayBuffer, file.name, evaluationMonth);
    parsed.codes.forEach((code) => extendedEmployeeCodes.add(code));
    filesMetadata.push({
      fileName: parsed.fileName,
      sheetName: parsed.sheetName,
      matchedByMonth: parsed.matchedByMonth,
      codeHeader: parsed.codeHeader,
      codesDetected: parsed.codes.length,
      rowCount: parsed.rowCount,
    });

    if (!parsed.matchedByMonth && evaluationMonth) {
      warnings.push(
        `No se encontró una hoja claramente asociada a ${evaluationMonth.label} en ${parsed.fileName}; se usó "${parsed.sheetName}".`,
      );
    }
  });

  return {
    evaluationMonth,
    extendedEmployeeCodes: Array.from(extendedEmployeeCodes),
    files: filesMetadata,
    warnings,
  };
}
