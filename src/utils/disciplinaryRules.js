import { getExpectedWindow, SCHEDULE_TYPES } from '../config/scheduleConfig.js';

export const DISCIPLINARY_CATEGORIES = {
  NONE: 'none',
  FIRST: 'first',
  SECOND: 'second',
  THIRD: 'third',
};

export const DISCIPLINARY_CATEGORY_META = {
  [DISCIPLINARY_CATEGORIES.NONE]: {
    id: DISCIPLINARY_CATEGORIES.NONE,
    label: 'Sin falta',
    shortLabel: 'Sin falta',
    colorName: 'Verde',
    excelColor: 'FFA9D18E',
    chartColor: '#a9d18e',
  },
  [DISCIPLINARY_CATEGORIES.FIRST]: {
    id: DISCIPLINARY_CATEGORIES.FIRST,
    label: 'Falta de 1er grado',
    shortLabel: '1er grado',
    colorName: 'Amarillo',
    excelColor: 'FFFFFF00',
    chartColor: '#facc15',
  },
  [DISCIPLINARY_CATEGORIES.SECOND]: {
    id: DISCIPLINARY_CATEGORIES.SECOND,
    label: 'Falta de 2do grado',
    shortLabel: '2do grado',
    colorName: 'Naranja',
    excelColor: 'FFFF6600',
    chartColor: '#f97316',
  },
  [DISCIPLINARY_CATEGORIES.THIRD]: {
    id: DISCIPLINARY_CATEGORIES.THIRD,
    label: 'Falta de 3er grado',
    shortLabel: '3er grado',
    colorName: 'Rojo',
    excelColor: 'FFFF0000',
    chartColor: '#ef4444',
  },
};

export function getDisciplinaryCategoryMeta(category) {
  return DISCIPLINARY_CATEGORY_META[category] ?? DISCIPLINARY_CATEGORY_META.none;
}

export function getDisciplinaryCategoryFromLabel(label) {
  const normalized = String(label ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  return (
    Object.values(DISCIPLINARY_CATEGORY_META).find(
      (category) =>
        category.label
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase() === normalized,
    )?.id ?? DISCIPLINARY_CATEGORIES.NONE
  );
}

export function classifyAccumulatedMinutes(totalMinutes) {
  const safeMinutes = Math.max(0, Math.floor(Number(totalMinutes || 0)));
  if (safeMinutes <= 120) return DISCIPLINARY_CATEGORIES.NONE;
  if (safeMinutes <= 300) return DISCIPLINARY_CATEGORIES.FIRST;
  if (safeMinutes <= 420) return DISCIPLINARY_CATEGORIES.SECOND;
  return DISCIPLINARY_CATEGORIES.THIRD;
}

function parseIsoDate(value) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isScheduledWorkday(date, scheduleType = SCHEDULE_TYPES.NORMAL) {
  return getExpectedWindow(scheduleType, date.getDay()).isWorkday;
}

function nextScheduledWorkdayIso(date, scheduleType) {
  let next = addDays(date, 1);
  for (let attempts = 0; attempts < 10; attempts += 1) {
    if (isScheduledWorkday(next, scheduleType)) return toIsoDate(next);
    next = addDays(next, 1);
  }
  return toIsoDate(addDays(date, 1));
}

export function getMaxConsecutiveWorkdayAbsences(absenceDates = [], scheduleType = SCHEDULE_TYPES.NORMAL) {
  const uniqueDates = Array.from(
    new Set(
      absenceDates
        .map((date) => parseIsoDate(date))
        .filter(Boolean)
        .filter((date) => isScheduledWorkday(date, scheduleType))
        .map(toIsoDate),
    ),
  ).sort();

  if (!uniqueDates.length) return 0;

  let maxStreak = 1;
  let currentStreak = 1;

  for (let index = 1; index < uniqueDates.length; index += 1) {
    const previousDate = parseIsoDate(uniqueDates[index - 1]);
    const expectedNext = nextScheduledWorkdayIso(previousDate, scheduleType);

    if (uniqueDates[index] === expectedNext) {
      currentStreak += 1;
    } else {
      currentStreak = 1;
    }

    maxStreak = Math.max(maxStreak, currentStreak);
  }

  return maxStreak;
}

export function classifyAbsences({ absenceCount = 0, maxConsecutiveAbsences = 0 }) {
  const safeCount = Math.max(0, Math.floor(Number(absenceCount || 0)));

  if (safeCount >= 3) return DISCIPLINARY_CATEGORIES.THIRD;
  if (safeCount >= 2) return DISCIPLINARY_CATEGORIES.SECOND;
  if (safeCount >= 1) return DISCIPLINARY_CATEGORIES.FIRST;
  return DISCIPLINARY_CATEGORIES.NONE;
}

export function buildEmployeeDisciplinarySummary(employee) {
  const maxConsecutiveAbsences =
    employee.maxAusenciasNoJustificadasConsecutivas ??
    getMaxConsecutiveWorkdayAbsences(employee.ausenciasNoJustificadasFechas, employee.scheduleType);

  const tardanzaCategory = classifyAccumulatedMinutes(employee.tiempoTardanzaNoJustificadaMin);
  const salidaTempranaCategory = classifyAccumulatedMinutes(
    employee.tiempoSalidaTempranaNoJustificadaMin,
  );
  const ausenciaCategory = classifyAbsences({
    absenceCount: employee.ausenciasNoJustificadas,
    maxConsecutiveAbsences,
  });

  return {
    tardanzas: {
      category: tardanzaCategory,
      ...getDisciplinaryCategoryMeta(tardanzaCategory),
    },
    salidasTempranas: {
      category: salidaTempranaCategory,
      ...getDisciplinaryCategoryMeta(salidaTempranaCategory),
    },
    ausencias: {
      category: ausenciaCategory,
      maxConsecutiveAbsences,
      ...getDisciplinaryCategoryMeta(ausenciaCategory),
    },
  };
}
