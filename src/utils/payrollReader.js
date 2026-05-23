import * as XLSX from 'xlsx';
import { getEmployeeCodeKeys } from './extendedScheduleReader.js';
import { parseDateValue } from './timeUtils.js';

const HEADER_ALIASES = {
  code: ['CODIGO', 'CODIGO EMPLEADO', 'CODIGO DE EMPLEADO', 'COD EMPLEADO', 'COD', 'ID EMPLEADO'],
  name: ['NOMBRE', 'NOMBRES', 'NOMBRE Y APELLIDO', 'NOMBRES Y APELLIDOS', 'EMPLEADO'],
  documentId: ['CEDULA', 'CÉDULA', 'DOCUMENTO', 'NO CEDULA', 'CEDULA IDENTIDAD'],
  position: ['CARGO', 'PUESTO', 'POSICION', 'POSICIÓN', 'FUNCION', 'FUNCIÓN'],
  location: ['UBICACION', 'UBICACIÓN', 'DEPARTAMENTO', 'AREA', 'ÁREA', 'DIRECCION', 'DIRECCIÓN'],
  hireDate: ['FECHA DE INGRESO', 'FECHA INGRESO', 'INGRESO', 'FECHA INICIO', 'FECHA DE ENTRADA'],
};

function normalizeHeader(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function findHeader(headers, aliases) {
  const aliasSet = new Set(aliases.map(normalizeHeader));
  const exact = headers.find((header) => aliasSet.has(normalizeHeader(header)));
  if (exact) return exact;

  return headers.find((header) => aliases.some((alias) => normalizeHeader(header).includes(normalizeHeader(alias)))) ?? null;
}

function inferPayrollMapping(rows = []) {
  const headers = rows.length ? Object.keys(rows[0]) : [];

  return Object.fromEntries(
    Object.entries(HEADER_ALIASES).map(([field, aliases]) => [field, findHeader(headers, aliases)]),
  );
}

function scorePayrollSheet(rows = []) {
  const mapping = inferPayrollMapping(rows);
  return ['code', 'position', 'location', 'hireDate', 'name'].reduce(
    (score, field) => score + (mapping[field] ? 1 : 0),
    0,
  );
}

function readWorkbookRows(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: true,
    raw: false,
  });

  const sheets = workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = worksheet ? XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false }) : [];
    return { sheetName, rows, score: scorePayrollSheet(rows) };
  }).sort((a, b) => b.score - a.score || b.rows.length - a.rows.length);

  return sheets[0] ?? { sheetName: '', rows: [], score: 0 };
}

function clean(value) {
  return String(value ?? '').trim();
}

function normalizePosition(value = '') {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_/]/g, ' ')
    .toUpperCase();
}

function isExcludedPosition(position) {
  const normalized = normalizePosition(position);
  return /\b(SUB\s*DIRECTOR|SUBDIRECTOR|DIRECTOR|DIRECTORA)\b/.test(normalized);
}

function isAfterEvaluationPeriod(hireDate, evaluationMonth) {
  if (!hireDate || !evaluationMonth) return false;
  const periodEnd = new Date(evaluationMonth.year, evaluationMonth.month + 1, 0, 23, 59, 59, 999);
  return hireDate.getTime() > periodEnd.getTime();
}

export function parsePayrollWorkbook(arrayBuffer, fileName, evaluationMonth) {
  if (!arrayBuffer) {
    return {
      fileName: '',
      sheetName: '',
      rowCount: 0,
      employeesDetected: 0,
      employeesByCode: {},
      warnings: [],
    };
  }

  const selectedSheet = readWorkbookRows(arrayBuffer);
  const mapping = inferPayrollMapping(selectedSheet.rows);
  const employeesByCode = {};
  const warnings = [];

  if (!mapping.code) warnings.push(`No se detectó la columna CODIGO en ${fileName}.`);
  if (!mapping.position) warnings.push(`No se detectó la columna CARGO en ${fileName}.`);
  if (!mapping.hireDate) warnings.push(`No se detectó la columna FECHA DE INGRESO en ${fileName}.`);

  selectedSheet.rows.forEach((row) => {
    const codeKeys = getEmployeeCodeKeys(row?.[mapping.code]);
    if (!codeKeys.length) return;

    const hireDate = parseDateValue(row?.[mapping.hireDate]);
    const position = clean(row?.[mapping.position]);
    const excludedByPosition = isExcludedPosition(position);
    const excludedByHireDate = isAfterEvaluationPeriod(hireDate, evaluationMonth);
    const record = {
      codigo: clean(row?.[mapping.code]),
      nombre: clean(row?.[mapping.name]),
      cedula: clean(row?.[mapping.documentId]),
      cargo: position,
      ubicacion: clean(row?.[mapping.location]),
      fechaIngreso: hireDate ? hireDate.toISOString().slice(0, 10) : clean(row?.[mapping.hireDate]),
      excluded: excludedByPosition || excludedByHireDate,
      exclusionReason: [
        excludedByPosition ? 'Cargo excluido por nómina' : '',
        excludedByHireDate ? 'Ingreso posterior al período evaluado' : '',
      ]
        .filter(Boolean)
        .join('; '),
    };

    codeKeys.forEach((code) => {
      employeesByCode[code] = record;
    });
  });

  return {
    fileName,
    sheetName: selectedSheet.sheetName,
    rowCount: selectedSheet.rows.length,
    employeesDetected: Object.keys(employeesByCode).length,
    mapping,
    employeesByCode,
    warnings,
  };
}
