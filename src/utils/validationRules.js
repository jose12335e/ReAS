import { CANONICAL_FIELDS } from './attendanceRules.js';
import { parseClockToMinutes, parseDateValue, parseDurationToMinutes } from './timeUtils.js';

const REQUIRED_FIELDS = [
  'nombre',
  'ubicacion',
  'codigo',
  'fecha',
  'dia',
  'entrada',
  'salida',
  'observaciones',
  'tiempoObservaciones',
];

const OPTIONAL_FIELDS = ['departamento', 'tipoHorario'];
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
const WARNING_FILE_SIZE_MB = 30;
const MAX_FILE_SIZE_MB = 75;
const MAX_DISPLAYED_ISSUES = 25;

export const FIELD_DEFINITIONS = [
  ...REQUIRED_FIELDS.map((key) => ({
    key,
    label: CANONICAL_FIELDS[key],
    required: true,
  })),
  ...OPTIONAL_FIELDS.map((key) => ({
    key,
    label: CANONICAL_FIELDS[key],
    required: false,
  })),
];

export function normalizeHeader(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function inferColumnMapping(headers = []) {
  const normalizedHeaders = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const mapping = {};

  FIELD_DEFINITIONS.forEach((field) => {
    const exact = normalizedHeaders.get(normalizeHeader(field.label));
    if (exact) mapping[field.key] = exact;
  });

  return mapping;
}

export function validateColumnMapping(mapping = {}) {
  const missing = REQUIRED_FIELDS.filter((field) => !mapping[field]);
  return {
    isValid: missing.length === 0,
    missing,
    errors: missing.map((field) => `Falta mapear la columna requerida: ${CANONICAL_FIELDS[field]}`),
  };
}

export function validateRows(rows = []) {
  const errors = [];
  if (!Array.isArray(rows) || rows.length === 0) {
    errors.push('El archivo no contiene filas procesables.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

function fileExtension(fileName = '') {
  const lowerName = String(fileName).toLowerCase();
  const dotIndex = lowerName.lastIndexOf('.');
  return dotIndex >= 0 ? lowerName.slice(dotIndex) : '';
}

function formatFileSize(size = 0) {
  if (!size) return '0 MB';
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function addLimitedIssue(target, message) {
  if (target.length < MAX_DISPLAYED_ISSUES) {
    target.push(message);
  }
}

function cellValue(row, mapping, field) {
  const header = mapping?.[field];
  return header ? row?.[header] : '';
}

function hasValue(value) {
  return String(value ?? '').trim() !== '';
}

function isValidDuration(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return true;
  if (/^[0:]+$/.test(raw)) return true;
  return parseDurationToMinutes(value) > 0;
}

export function validateFileForUpload(file, { required = false, label = 'archivo' } = {}) {
  const errors = [];
  const warnings = [];

  if (!file) {
    if (required) errors.push(`Debes seleccionar el ${label}.`);
    return { isValid: errors.length === 0, errors, warnings };
  }

  const extension = fileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    errors.push(
      `${file.name}: formato no permitido. Solo se aceptan ${ALLOWED_EXTENSIONS.join(', ')}.`,
    );
  }

  if (!file.size) {
    errors.push(`${file.name}: el archivo está vacío.`);
  }

  const sizeMb = file.size / 1024 / 1024;
  if (sizeMb > MAX_FILE_SIZE_MB) {
    errors.push(
      `${file.name}: pesa ${formatFileSize(file.size)}. Reduce el archivo antes de procesarlo.`,
    );
  } else if (sizeMb > WARNING_FILE_SIZE_MB) {
    warnings.push(
      `${file.name}: pesa ${formatFileSize(file.size)} y puede tardar más de lo normal.`,
    );
  }

  return { isValid: errors.length === 0, errors, warnings };
}

export function validateFilesForUpload(files = [], options = {}) {
  const result = files.reduce(
    (acc, file) => {
      const validation = validateFileForUpload(file, options);
      acc.errors.push(...validation.errors);
      acc.warnings.push(...validation.warnings);
      return acc;
    },
    { isValid: true, errors: [], warnings: [] },
  );

  return {
    ...result,
    isValid: result.errors.length === 0,
  };
}

export function validateWorkbookData(rows = [], mapping = {}) {
  const columnValidation = validateColumnMapping(mapping);
  const rowValidation = validateRows(rows);
  const errors = [...columnValidation.errors, ...rowValidation.errors];
  const warnings = [];
  const stats = {
    rowCount: Array.isArray(rows) ? rows.length : 0,
    checkedRows: 0,
    emptyCodes: 0,
    emptyNames: 0,
    invalidDates: 0,
    invalidEntryTimes: 0,
    invalidExitTimes: 0,
    invalidObservationTimes: 0,
  };

  if (!columnValidation.isValid || !Array.isArray(rows) || !rows.length) {
    return {
      isValid: errors.length === 0,
      hasWarnings: warnings.length > 0,
      errors,
      warnings,
      stats,
    };
  }

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    stats.checkedRows += 1;
    const code = cellValue(row, mapping, 'codigo');
    const name = cellValue(row, mapping, 'nombre');
    const date = cellValue(row, mapping, 'fecha');
    const entry = cellValue(row, mapping, 'entrada');
    const exit = cellValue(row, mapping, 'salida');
    const observationTime = cellValue(row, mapping, 'tiempoObservaciones');

    if (!hasValue(code)) {
      stats.emptyCodes += 1;
      addLimitedIssue(errors, `Fila ${rowNumber}: CODIGO vacío.`);
    }

    if (!hasValue(name)) {
      stats.emptyNames += 1;
      addLimitedIssue(errors, `Fila ${rowNumber}: NOMBRE vacío.`);
    }

    if (!parseDateValue(date)) {
      stats.invalidDates += 1;
      addLimitedIssue(errors, `Fila ${rowNumber}: FECHA inválida (${date || 'vacía'}).`);
    }

    if (hasValue(entry) && parseClockToMinutes(entry) === null) {
      stats.invalidEntryTimes += 1;
      addLimitedIssue(warnings, `Fila ${rowNumber}: HORA DE ENTRADA con formato no reconocido (${entry}).`);
    }

    if (hasValue(exit) && parseClockToMinutes(exit) === null) {
      stats.invalidExitTimes += 1;
      addLimitedIssue(warnings, `Fila ${rowNumber}: HORA DE SALIDA con formato no reconocido (${exit}).`);
    }

    if (hasValue(observationTime) && !isValidDuration(observationTime)) {
      stats.invalidObservationTimes += 1;
      addLimitedIssue(
        warnings,
        `Fila ${rowNumber}: TIEMPO DE OBSERVACIONES inválido (${observationTime}).`,
      );
    }
  });

  const hiddenErrorCount =
    stats.emptyCodes + stats.emptyNames + stats.invalidDates - errors.filter((message) => /^Fila/.test(message)).length;
  const hiddenWarningCount =
    stats.invalidEntryTimes +
    stats.invalidExitTimes +
    stats.invalidObservationTimes -
    warnings.filter((message) => /^Fila/.test(message)).length;

  if (hiddenErrorCount > 0) {
    errors.push(`Hay ${hiddenErrorCount.toLocaleString('es-DO')} error(es) adicional(es) no listados.`);
  }
  if (hiddenWarningCount > 0) {
    warnings.push(`Hay ${hiddenWarningCount.toLocaleString('es-DO')} advertencia(s) adicional(es) no listadas.`);
  }

  if (stats.rowCount > 50000) {
    warnings.push(
      `El archivo tiene ${stats.rowCount.toLocaleString('es-DO')} filas. El procesamiento puede tardar más de lo normal.`,
    );
  }

  return {
    isValid: errors.length === 0,
    hasWarnings: warnings.length > 0,
    errors,
    warnings,
    stats,
  };
}

export function validateWorkbookDataForMonth(rows = [], mapping = {}, selectedMonth = null) {
  if (!selectedMonth) return validateWorkbookData(rows, mapping);

  const filteredRows = rows.filter((row) => {
    const parsedDate = parseDateValue(cellValue(row, mapping, 'fecha'));
    return (
      parsedDate &&
      parsedDate.getFullYear() === Number(selectedMonth.year) &&
      parsedDate.getMonth() === Number(selectedMonth.month)
    );
  });

  return validateWorkbookData(filteredRows, mapping);
}
