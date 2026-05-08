import { CANONICAL_FIELDS } from './attendanceRules.js';

const REQUIRED_FIELDS = [
  'nombre',
  'ubicacion',
  'codigo',
  'fecha',
  'dia',
  'entrada',
  'salida',
  'observaciones',
];

const OPTIONAL_FIELDS = ['departamento', 'tiempoObservaciones', 'tipoHorario'];

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
