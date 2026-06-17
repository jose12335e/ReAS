import * as XLSX from 'xlsx';
import { getEmployeeCodeKeys } from './extendedScheduleReader.js';
import { parseDateValue } from './timeUtils.js';

const HEADER_ALIASES = {
  code: ['CODIGO', 'CODIGO EMPLEADO', 'CODIGO DE EMPLEADO', 'COD EMPLEADO', 'COD', 'ID EMPLEADO'],
  name: ['NOMBRE', 'NOMBRES', 'NOMBRE COMPLETO', 'NOMBRE Y APELLIDO', 'NOMBRES Y APELLIDOS'],
  documentId: ['CEDULA', 'CÉDULA', 'DOCUMENTO', 'NO CEDULA', 'CEDULA IDENTIDAD'],
  position: ['CARGO', 'PUESTO', 'POSICION', 'POSICIÓN', 'FUNCION', 'FUNCIÓN'],
  hierarchyPosition: ['POSICION', 'POSICIÓN'],
  location: ['UBICACION', 'UBICACIÓN', 'DEPARTAMENTO', 'AREA', 'ÁREA', 'DIRECCION', 'DIRECCIÓN'],
  hireDate: ['FECHA DE INGRESO', 'FECHA INGRESO', 'INGRESO', 'FECHA INICIO', 'FECHA DE ENTRADA'],
};

export const PAYROLL_FIELD_DEFINITIONS = [
  { key: 'code', label: 'Codigo empleado', required: true },
  { key: 'name', label: 'Nombre completo', required: false },
  { key: 'documentId', label: 'Cedula', required: false },
  { key: 'position', label: 'Cargo', required: true },
  { key: 'hierarchyPosition', label: 'Posicion', required: false },
  { key: 'location', label: 'Ubicacion', required: false },
  { key: 'hireDate', label: 'Fecha de ingreso', required: true },
];

function normalizeHeader(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isCodeLikeHeader(header) {
  const normalized = normalizeHeader(header);
  return /\b(CODIGO|COD|ID|CEDULA|DOCUMENTO)\b/.test(normalized);
}

function isNameLikeHeader(header) {
  const normalized = normalizeHeader(header);
  return /\b(NOMBRE|NOMBRES|APELLIDO|APELLIDOS)\b/.test(normalized) && !isCodeLikeHeader(header);
}

function isHierarchyPositionHeader(header) {
  return /^POSICION\b/.test(normalizeHeader(header));
}

function findHeader(headers, aliases, field) {
  if (field === 'name') {
    const nameHeader = headers.find(isNameLikeHeader);
    if (nameHeader) return nameHeader;
  }

  const aliasSet = new Set(aliases.map(normalizeHeader));
  const exact = headers.find((header) => {
    if (field === 'name' && isCodeLikeHeader(header)) return false;
    if (field === 'position' && isHierarchyPositionHeader(header)) return false;
    return aliasSet.has(normalizeHeader(header));
  });
  if (exact) return exact;

  return (
    headers.find((header) => {
      if (field === 'name' && !isNameLikeHeader(header)) return false;
      if (field === 'position' && isHierarchyPositionHeader(header)) return false;
      return aliases.some((alias) => normalizeHeader(header).includes(normalizeHeader(alias)));
    }) ?? null
  );
}

export function inferPayrollMapping(rows = []) {
  const headers = rows.length ? Object.keys(rows[0]) : [];

  return Object.fromEntries(
    Object.entries(HEADER_ALIASES).map(([field, aliases]) => [
      field,
      findHeader(headers, aliases, field),
    ]),
  );
}

function inferPayrollMappingFromHeaders(headers = []) {
  if (!headers.length) return inferPayrollMapping([]);
  const headerRow = Object.fromEntries(headers.map((header) => [header, '']));
  return inferPayrollMapping([headerRow]);
}

function scorePayrollSheet(rows = []) {
  const mapping = inferPayrollMapping(rows);
  return ['code', 'position', 'location', 'hireDate', 'name'].reduce(
    (score, field) => score + (mapping[field] ? 1 : 0),
    0,
  );
}

function worksheetRange(worksheet) {
  if (!worksheet?.['!ref']) return null;
  return XLSX.utils.decode_range(worksheet['!ref']);
}

function rowsFromSheetPreview(worksheet, previewLimit = 5) {
  const range = worksheetRange(worksheet);
  if (!range) {
    return { headers: [], previewRows: [], rowCount: 0 };
  }

  const previewRange = {
    s: range.s,
    e: {
      r: Math.min(range.e.r, range.s.r + previewLimit),
      c: range.e.c,
    },
  };
  const matrix = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
    range: previewRange,
  });
  const headers = (matrix[0] ?? []).map((header, index) => clean(header) || `Columna ${index + 1}`);
  const previewRows = matrix.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])),
  );

  return {
    headers,
    previewRows,
    rowCount: Math.max(0, range.e.r - range.s.r),
  };
}

function scorePayrollMapping(mapping = {}) {
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
    const preview = rowsFromSheetPreview(worksheet);
    const mapping = inferPayrollMappingFromHeaders(preview.headers);
    return {
      sheetName,
      score: scorePayrollMapping(mapping),
      rowCount: preview.rowCount,
    };
  }).sort((a, b) => b.score - a.score || b.rowCount - a.rowCount);

  const selectedSheet = sheets[0] ?? { sheetName: '', score: 0 };
  const worksheet = workbook.Sheets[selectedSheet.sheetName];
  const rows = worksheet ? XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false }) : [];
  return { ...selectedSheet, rows };
}

export function previewPayrollWorkbook(arrayBuffer, fileName) {
  if (!arrayBuffer) return null;
  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: true,
    raw: false,
  });
  const sheets = workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const preview = rowsFromSheetPreview(worksheet);
    const mapping = inferPayrollMappingFromHeaders(preview.headers);
    return {
      sheetName,
      headers: preview.headers,
      previewRows: preview.previewRows,
      rowCount: preview.rowCount,
      mapping,
      score: scorePayrollMapping(mapping),
    };
  }).sort((a, b) => b.score - a.score || b.rowCount - a.rowCount);
  const selectedSheet = sheets[0] ?? {
    sheetName: '',
    headers: [],
    previewRows: [],
    rowCount: 0,
    mapping: {},
  };

  return {
    fileName,
    selectedSheetName: selectedSheet.sheetName,
    sheets,
    headers: selectedSheet.headers,
    previewRows: selectedSheet.previewRows,
    mapping: selectedSheet.mapping,
  };
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

function isExcludedPosition(position, hierarchyPosition = '') {
  const normalized = normalizePosition(position);
  const normalizedHierarchyPosition = normalizePosition(hierarchyPosition);
  return (
    /\b(SUB\s*DIRECTOR|SUBDIRECTOR|DIRECTOR|DIRECTORA)\b/.test(normalized) ||
    /\bDIRECCION\s+V\b/.test(normalizedHierarchyPosition)
  );
}

function isAfterEvaluationPeriod(hireDate, evaluationMonth) {
  if (!hireDate || !evaluationMonth) return false;
  const periodEnd = new Date(evaluationMonth.year, evaluationMonth.month + 1, 0, 23, 59, 59, 999);
  return hireDate.getTime() > periodEnd.getTime();
}

export function parsePayrollWorkbook(arrayBuffer, fileName, evaluationMonth, options = {}) {
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

  const selectedSheet = options.sheetName
    ? (() => {
        const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true, raw: false });
        const worksheet = workbook.Sheets[options.sheetName];
        const rows = worksheet ? XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false }) : [];
        return { sheetName: options.sheetName, rows, score: scorePayrollSheet(rows) };
      })()
    : readWorkbookRows(arrayBuffer);
  const mapping = { ...inferPayrollMapping(selectedSheet.rows), ...(options.mapping ?? {}) };
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
    const hierarchyPosition = clean(row?.[mapping.hierarchyPosition]);
    const excludedByPosition = isExcludedPosition(position, hierarchyPosition);
    const excludedByHierarchyPosition = /\bDIRECCION\s+V\b/.test(normalizePosition(hierarchyPosition));
    const excludedByHireDate = isAfterEvaluationPeriod(hireDate, evaluationMonth);
    const record = {
      codigo: clean(row?.[mapping.code]),
      nombre: clean(row?.[mapping.name]),
      cedula: clean(row?.[mapping.documentId]),
      cargo: position,
      posicion: hierarchyPosition,
      ubicacion: clean(row?.[mapping.location]),
      fechaIngreso: hireDate ? hireDate.toISOString().slice(0, 10) : clean(row?.[mapping.hireDate]),
      excluded: excludedByPosition || excludedByHireDate,
      excludedByPosition,
      excludedByHierarchyPosition,
      excludedByHireDate,
      exclusionReason: [
        excludedByPosition ? 'Cargo/posición excluida por nómina' : '',
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
