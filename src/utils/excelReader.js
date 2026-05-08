import * as XLSX from 'xlsx';
import { inferColumnMapping, validateRows } from './validationRules.js';

export function parseExcelArrayBuffer(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: true,
    raw: false,
  });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return {
      headers: [],
      rows: [],
      previewRows: [],
      sheetName: '',
      mapping: {},
      validation: { isValid: false, errors: ['El archivo no contiene hojas.'] },
    };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false,
  });
  const headers = rows.length ? Object.keys(rows[0]) : [];

  return {
    headers,
    rows,
    previewRows: rows.slice(0, 50),
    sheetName: firstSheetName,
    mapping: inferColumnMapping(headers),
    validation: validateRows(rows),
  };
}
