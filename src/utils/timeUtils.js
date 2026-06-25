const DAY_NAMES = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

export function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function excelSerialDateToDate(serial) {
  if (typeof serial !== 'number' || Number.isNaN(serial)) return null;
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000);
}

export function parseDateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number') return excelSerialDateToDate(value);

  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const isoDateOnly = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoDateOnly) {
    const [, yyyy, mm, dd] = isoDateOnly;
    const parsed = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    const year = yyyy.length === 2 ? `20${yyyy}` : yyyy;
    const parsed = new Date(Number(year), Number(mm) - 1, Number(dd));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const isoCandidate = new Date(raw);
  return Number.isNaN(isoCandidate.getTime()) ? null : isoCandidate;
}

export function getDayIndex({ dayName, dateValue }) {
  const normalizedDay = normalizeText(dayName);
  if (normalizedDay in DAY_NAMES) return DAY_NAMES[normalizedDay];

  const parsedDate = parseDateValue(dateValue);
  if (parsedDate) return parsedDate.getDay();

  return null;
}

export function parseTimeToMinutes(value) {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getHours() * 60 + value.getMinutes();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 0 && value < 1) return Math.round(value * 24 * 60);
    if (value >= 1 && value < 24) return Math.round(value * 60);
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const normalized = normalizeText(raw)
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .replace('a m', 'am')
    .replace('p m', 'pm');

  const match = normalized.match(/^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?\s*(am|pm)?$/);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const marker = match[4];

  if (minutes > 59 || seconds > 59 || hours > 24) return null;

  if (marker === 'pm' && hours < 12) hours += 12;
  if (marker === 'am' && hours === 12) hours = 0;
  if (hours === 24) hours = 0;

  return hours * 60 + minutes + Math.round(seconds / 60);
}

export function parseClockToMinutes(value) {
  return parseTimeToMinutes(value);
}

export function parseDurationToMinutes(value) {
  if (value === null || value === undefined || value === '') return 0;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getHours() * 60 + value.getMinutes() + Math.round(value.getSeconds() / 60);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 0 && value < 1) return Math.round(value * 24 * 60);
    return Math.round(value * 60);
  }

  const raw = String(value).trim();
  if (!raw) return 0;

  const normalized = normalizeText(raw).replace(',', '.');
  const clockMatch = normalized.match(/^(\d+)(?::(\d{1,2}))?(?::(\d{1,2}))?$/);
  if (clockMatch) {
    const hours = Number(clockMatch[1] ?? 0);
    const minutes = Number(clockMatch[2] ?? 0);
    const seconds = Number(clockMatch[3] ?? 0);
    if (minutes <= 59 && seconds <= 59) return hours * 60 + minutes + Math.round(seconds / 60);
  }

  const decimalHours = Number(normalized);
  return Number.isFinite(decimalHours) ? Math.round(decimalHours * 60) : 0;
}

export function diffMinutes(startMinutes, endMinutes) {
  if (startMinutes === null || endMinutes === null) return 0;
  let diff = endMinutes - startMinutes;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

export function minutesToHours(minutes = 0) {
  return Math.round((Number(minutes || 0) / 60) * 100) / 100;
}

export function formatMinutes(minutes = 0) {
  const safeMinutes = Math.max(0, Math.round(Number(minutes || 0)));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function safeNumber(value = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}
