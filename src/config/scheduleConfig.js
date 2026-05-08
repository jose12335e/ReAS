export const SCHEDULE_TYPES = {
  NORMAL: 'normal',
  EXTENDED: 'extended',
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
};

export const DEFAULT_SCHEDULE_TYPE = SCHEDULE_TYPES.NORMAL;

export const groupingConfig = {
  primaryGroup: 'ubicacion',
  futurePrimaryGroup: 'departamento',
  employeeKey: ['codigo', 'nombre'],
};

export function getScheduleDefinition(scheduleType = DEFAULT_SCHEDULE_TYPE) {
  return scheduleConfig[scheduleType] ?? scheduleConfig[DEFAULT_SCHEDULE_TYPE];
}

export function getExpectedWindow(scheduleType, dayIndex) {
  const schedule = getScheduleDefinition(scheduleType);
  const day = schedule.days[dayIndex];

  return {
    entry: day?.entry ?? null,
    exit: day?.exit ?? null,
    expectedMinutes: Math.round((day?.expectedHours ?? 0) * 60),
    isWorkday: schedule.workDays.includes(dayIndex),
    scheduleLabel: schedule.label,
  };
}
