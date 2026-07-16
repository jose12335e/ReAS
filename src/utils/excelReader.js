import * as XLSX from 'xlsx';
import { inferColumnMapping, validateRows } from './validationRules.js';

function rowsFromWorksheet(worksheet) {
  return worksheet
    ? XLSX.utils.sheet_to_json(worksheet, {
        defval: '',
        raw: false,
      })
    : [];
}

function worksheetRange(worksheet) {
  if (!worksheet?.['!ref']) return null;
  return XLSX.utils.decode_range(worksheet['!ref']);
}

function buildSheetPreview(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  const range = worksheetRange(sheet);
  if (!range) {
    return {
      sheetName,
      headers: [],
      previewRows: [],
      rowCount: 0,
      mapping: {},
    };
  }
  const previewRange = {
    s: range.s,
    e: {
      r: Math.min(range.e.r, range.s.r + 5),
      c: range.e.c,
    },
  };
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
    range: previewRange,
  });
  const headers = (matrix[0] ?? []).map((header, index) => String(header || `Columna ${index + 1}`).trim());
  const previewRows = matrix.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])),
  );
  return {
    sheetName,
    headers,
    previewRows,
    rowCount: Math.max(0, range.e.r - range.s.r),
    mapping: inferColumnMapping(headers),
  };
}

export function readExcelWorkbook(arrayBuffer) {
  return XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: true,
    raw: false,
  });
}

export function parseExcelWorkbook(workbook, selectedSheetName) {
  const sheetNames = workbook?.SheetNames ?? [];
  const firstSheetName = sheetNames[0];

  if (!firstSheetName) {
    return {
      headers: [],
      rows: [],
      previewRows: [],
      sheetName: '',
      selectedSheetName: '',
      sheets: [],
      mapping: {},
      validation: { isValid: false, errors: ['El archivo no contiene hojas.'] },
    };
  }

  const sheetName = sheetNames.includes(selectedSheetName) ? selectedSheetName : firstSheetName;
  const sheets = sheetNames.map((name) => {
    const preview = buildSheetPreview(workbook, name);
    return {
      sheetName: name,
      headers: preview.headers,
      previewRows: preview.previewRows,
      rowCount: preview.rowCount,
      mapping: preview.mapping,
    };
  });
  const selectedSheet = sheets.find((sheet) => sheet.sheetName === sheetName) ?? sheets[0];
  const rows = rowsFromWorksheet(workbook.Sheets[sheetName]);
  const headers = rows.length ? Object.keys(rows[0]) : selectedSheet.headers ?? [];

  return {
    headers,
    rows,
    previewRows: rows.slice(0, 50),
    sheetName,
    selectedSheetName: sheetName,
    sheets,
    mapping: inferColumnMapping(headers),
    validation: validateRows(rows),
  };
}

export function parseExcelArrayBuffer(arrayBuffer, selectedSheetName) {
  return parseExcelWorkbook(readExcelWorkbook(arrayBuffer), selectedSheetName);
}
