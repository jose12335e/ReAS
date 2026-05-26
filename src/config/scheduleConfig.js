export const SCHEDULE_TYPES = {
  NORMAL: 'normal',
  EXTENDED: 'extended',
  MODIFIED: 'modified',
};

export const WEEK_DAYS = [
  { index: 1, label: 'Lunes', shortLabel: 'Lun' },
  { index: 2, label: 'Martes', shortLabel: 'Mar' },
  { index: 3, label: 'Miercoles', shortLabel: 'Mie' },
  { index: 4, label: 'Jueves', shortLabel: 'Jue' },
  { index: 5, label: 'Viernes', shortLabel: 'Vie' },
  { index: 6, label: 'Sabado', shortLabel: 'Sab' },
  { index: 0, label: 'Domingo', shortLabel: 'Dom' },
];

export const DEFAULT_MODIFIED_SCHEDULE = {
  days: {
    1: { enabled: true, entry: '08:00', exit: '16:00' },
    2: { enabled: true, entry: '08:00', exit: '16:00' },
    3: { enabled: true, entry: '08:00', exit: '16:00' },
    4: { enabled: true, entry: '08:00', exit: '16:00' },
    5: { enabled: true, entry: '08:00', exit: '16:00' },
    6: { enabled: false, entry: '09:00', exit: '13:00' },
    0: { enabled: false, entry: '08:00', exit: '16:00' },
  },
};

export const scheduleConfig = {
  [SCHEDULE_TYPES.NORMAL]: {
    id: SCHEDULE_TYPES.NORMAL,
    label: 'Horario normal',
    defaultEntry: '08:00',
    workDays: [1, 2, 3, 4, 5],
    days: {
      1: { entry: '08:00', exit: '16:00', expectedHours: 8 },
      2: { entry: '08:00', exit: '16:00', expectedHours: 8 },
      3: { entry: '08:00', exit: '16:00', expectedHours: 8 },
      4: { entry: '08:00', exit: '16:00', expectedHours: 8 },
      5: { entry: '08:00', exit: '16:00', expectedHours: 8 },
    },
  },
  [SCHEDULE_TYPES.EXTENDED]: {
    id: SCHEDULE_TYPES.EXTENDED,
    label: 'Horario extendido',
    defaultEntry: '08:00',
    workDays: [1, 2, 3, 4, 5, 6],
    days: {
      1: { entry: '08:00', exit: '19:00', expectedHours: 11 },
      2: { entry: '08:00', exit: '19:00', expectedHours: 11 },
      3: { entry: '08:00', exit: '19:00', expectedHours: 11 },
      4: { entry: '08:00', exit: '19:00', expectedHours: 11 },
      5: { entry: '08:00', exit: '19:00', expectedHours: 11 },
      6: { entry: '09:00', exit: '13:00', expectedHours: 4 },
      0: { entry: null, exit: null, expectedHours: 0 },
    },
  },
  [SCHEDULE_TYPES.MODIFIED]: {
    id: SCHEDULE_TYPES.MODIFIED,
    label: 'Horario modificado',
    defaultEntry: '08:00',
    workDays: [1, 2, 3, 4, 5],
    days: {
      1: { entry: '08:00', exit: '16:00', expectedHours: 8 },
      2: { entry: '08:00', exit: '16:00', expectedHours: 8 },
      3: { entry: '08:00', exit: '16:00', expectedHours: 8 },
      4: { entry: '08:00', exit: '16:00', expectedHours: 8 },
      5: { entry: '08:00', exit: '16:00', expectedHours: 8 },
      6: { entry: null, exit: null, expectedHours: 0 },
      0: { entry: null, exit: null, expectedHours: 0 },
    },
  },
};

export const DEFAULT_SCHEDULE_TYPE = SCHEDULE_TYPES.NORMAL;

export const groupingConfig = {
  primaryGroup: 'ubicacion',
  futurePrimaryGroup: 'departamento',
  employeeKey: ['codigo', 'nombre'],
};

function parseTimeToMinutes(value) {
  const match = String(value ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function expectedHoursFromWindow(entry, exit) {
  const entryMinutes = parseTimeToMinutes(entry);
  const exitMinutes = parseTimeToMinutes(exit);
  if (entryMinutes === null || exitMinutes === null) return 0;
  const diff = exitMinutes >= entryMinutes ? exitMinutes - entryMinutes : exitMinutes + 1440 - entryMinutes;
  return Math.round((diff / 60) * 100) / 100;
}

export function buildModifiedSchedule(customSchedule = DEFAULT_MODIFIED_SCHEDULE) {
  const sourceDays = customSchedule?.days ?? DEFAULT_MODIFIED_SCHEDULE.days;
  const days = {};
  const workDays = [];

  WEEK_DAYS.forEach(({ index }) => {
    const fallback = DEFAULT_MODIFIED_SCHEDULE.days[index];
    const source = sourceDays[index] ?? sourceDays[String(index)] ?? fallback;
    const enabled = Boolean(source?.enabled);
    const entry = enabled ? source?.entry || fallback.entry : null;
    const exit = enabled ? source?.exit || fallback.exit : null;
    const expectedHours = enabled ? expectedHoursFromWindow(entry, exit) : 0;

    days[index] = { entry, exit, expectedHours };
    if (enabled && expectedHours > 0) workDays.push(index);
  });

  return {
    ...scheduleConfig[SCHEDULE_TYPES.MODIFIED],
    workDays,
    days,
  };
}

export function getScheduleDefinition(scheduleType = DEFAULT_SCHEDULE_TYPE, customSchedule) {
  if (scheduleType === SCHEDULE_TYPES.MODIFIED) return buildModifiedSchedule(customSchedule);
  return scheduleConfig[scheduleType] ?? scheduleConfig[DEFAULT_SCHEDULE_TYPE];
}

export function getExpectedWindow(scheduleType, dayIndex, customSchedule) {
  const schedule = getScheduleDefinition(scheduleType, customSchedule);
  const day = schedule.days[dayIndex];

  return {
    entry: day?.entry ?? null,
    exit: day?.exit ?? null,
    expectedMinutes: Math.round((day?.expectedHours ?? 0) * 60),
    isWorkday: schedule.workDays.includes(dayIndex),
    scheduleLabel: schedule.label,
  };
}
