import { classifyObservation } from '../config/observationKeywords.js';
import {
  DEFAULT_SCHEDULE_TYPE,
  getExpectedWindow,
  getScheduleDefinition,
  SCHEDULE_TYPES,
} from '../config/scheduleConfig.js';
import {
  diffMinutes,
  formatMinutes,
  getDayIndex,
  minutesToHours,
  parseClockToMinutes,
  parseDateValue,
  parseDurationToMinutes,
} from './timeUtils.js';
import { getEmployeeCodeKeys } from './extendedScheduleReader.js';
import {
  EVENTUALITY_TYPES,
  findEventualitiesForRow,
} from './eventualitiesReader.js';
import {
  buildEmployeeDisciplinarySummary,
  getMaxConsecutiveWorkdayAbsences,
} from './disciplinaryRules.js';

const NON_EVENTUALITY_TYPES = new Set([
  EVENTUALITY_TYPES.VACATION,
  EVENTUALITY_TYPES.TRAVEL,
  EVENTUALITY_TYPES.HOLIDAY,
  EVENTUALITY_TYPES.IRREGULAR_PUNCH,
]);

export const CANONICAL_FIELDS = {
  nombre: 'NOMBRE',
  ubicacion: 'UBICACION',
  departamento: 'DEPARTAMENTO',
  codigo: 'CODIGO',
  fecha: 'FECHA',
  dia: 'DIA',
  entrada: 'HORA DE ENTRADA',
  salida: 'HORA DE SALIDA',
  observaciones: 'OBSERVACIONES',
  tiempoObservaciones: 'TIEMPO DE OBSERVACIONES',
  tipoHorario: 'TIPO HORARIO',
};

const INITIAL_METRICS = {
  diasLaborables: 0,
  diasATrabajar: 0,
  diasTrabajadosCompletos: 0,
  vacaciones: 0,
  licencias: 0,
  permisos: 0,
  ausenciasJustificadas: 0,
  ausenciasNoJustificadas: 0,
  tardanzasJustificadas: 0,
  tardanzasNoJustificadas: 0,
  salidasTempranasJustificadas: 0,
  salidasTempranasNoJustificadas: 0,
  ponchesIrregulares: 0,
  horasEsperadasMin: 0,
  horasTrabajadasRealesMin: 0,
  horasTrabajadasReconocidasMin: 0,
  tiempoTardanzaMin: 0,
  tiempoTardanzaJustificadaMin: 0,
  tiempoTardanzaNoJustificadaMin: 0,
  tiempoSalidaTempranaMin: 0,
  tiempoSalidaTempranaJustificadaMin: 0,
  tiempoSalidaTempranaNoJustificadaMin: 0,
  horasAusenciaMin: 0,
  tiempoAusenciaJustificadaMin: 0,
  tiempoAusenciaNoJustificadaMin: 0,
  eventualidadesJustificadas: 0,
  tiempoEventualidadJustificadaMin: 0,
  tiempoNoTrabajadoJustificadoMin: 0,
  tiempoNoTrabajadoNoJustificadoMin: 0,
  verViatico: 0,
};

export function createEmptyMetrics(overrides = {}) {
  return { ...INITIAL_METRICS, ...overrides };
}

function asValue(row, mapping, field) {
  const header = mapping?.[field] || CANONICAL_FIELDS[field];
  return row?.[header] ?? '';
}

function clean(value) {
  return String(value ?? '').trim();
}

function findPayrollRecord(payrollEmployeesByCode, code) {
  if (!payrollEmployeesByCode || !code) return null;
  const codeKeys = getEmployeeCodeKeys(code);
  return codeKeys.map((key) => payrollEmployeesByCode[key]).find(Boolean) ?? null;
}

function dateOnlyTimestamp(value) {
  const parsed = parseDateValue(value);
  if (!parsed) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
}

function isBeforeHireDate(rawRow, mapping, payrollRecord) {
  if (!payrollRecord?.fechaIngreso) return false;
  const rowDate = dateOnlyTimestamp(asValue(rawRow, mapping, 'fecha'));
  const hireDate = dateOnlyTimestamp(payrollRecord.fechaIngreso);
  return rowDate !== null && hireDate !== null && rowDate < hireDate;
}

function detectScheduleType(row, mapping, defaultScheduleType, extendedEmployeeCodes) {
  const codeKeys = getEmployeeCodeKeys(asValue(row, mapping, 'codigo'));
  const raw = clean(asValue(row, mapping, 'tipoHorario')).toLowerCase();
  if (raw.includes('extend')) return SCHEDULE_TYPES.EXTENDED;
  if (raw.includes('modif')) return SCHEDULE_TYPES.MODIFIED;
  if (raw.includes('matut') && raw.includes('9')) return SCHEDULE_TYPES.MORNING_9_TO_3;
  if (raw.includes('vesp') && raw.includes('3')) return SCHEDULE_TYPES.EVENING_3_TO_9;
  if (raw.includes('matut') && raw.includes('8')) return SCHEDULE_TYPES.MORNING_8_TO_2;
  if (raw.includes('vesp') && raw.includes('2')) return SCHEDULE_TYPES.EVENING_2_TO_8;
  if (raw.includes('normal')) return SCHEDULE_TYPES.NORMAL;
  if (codeKeys.some((code) => extendedEmployeeCodes?.has(code))) return SCHEDULE_TYPES.EXTENDED;
  return defaultScheduleType || DEFAULT_SCHEDULE_TYPE;
}

function createEmployeeRecord({
  codigo,
  nombre,
  ubicacion,
  departamento,
  cargo,
  posicion,
  cedula,
  fechaIngreso,
  scheduleType,
  modifiedSchedule,
}) {
  const schedule = getScheduleDefinition(scheduleType, modifiedSchedule);
  return {
    codigo,
    nombre,
    ubicacion,
    departamento,
    cargo,
    posicion,
    cedula,
    fechaIngreso,
    tipoHorario: schedule.label,
    scheduleType,
    ...createEmptyMetrics(),
    ausenciasNoJustificadasFechas: [],
    observacionesProcesadas: new Set(),
    estados: new Set(),
  };
}

function addMetrics(target, source) {
  Object.keys(INITIAL_METRICS).forEach((key) => {
    target[key] += source[key] ?? 0;
  });
  return target;
}

function addEvent(events, type, row) {
  events[type].push(row);
}

function buildExcludedPayrollProcessedRow({ rawRow, mapping, index, rawCode, payrollRecord, reason }) {
  return {
    '#': index + 1,
    NOMBRE: payrollRecord.nombre || clean(asValue(rawRow, mapping, 'nombre')),
    CODIGO: rawCode,
    UBICACION: payrollRecord.ubicacion || clean(asValue(rawRow, mapping, 'ubicacion')) || 'Sin ubicacion',
    DEPARTAMENTO: payrollRecord.ubicacion || '',
    CARGO: payrollRecord.cargo || '',
    POSICION: payrollRecord.posicion || '',
    CEDULA: payrollRecord.cedula || '',
    'Fecha ingreso': payrollRecord.fechaIngreso || '',
    FECHA: clean(asValue(rawRow, mapping, 'fecha')),
    DIA: clean(asValue(rawRow, mapping, 'dia')),
    'Tipo horario': '',
    'Hora entrada': clean(asValue(rawRow, mapping, 'entrada')),
    'Hora salida': clean(asValue(rawRow, mapping, 'salida')),
    'Tiempo observaciones': clean(asValue(rawRow, mapping, 'tiempoObservaciones')),
    'Horas esperadas': 0,
    'Horas trabajadas reales': 0,
    'Horas trabajadas reconocidas': 0,
    'Tiempo tardanza': '00:00',
    'Tiempo salida temprana': '00:00',
    'Tiempo no trabajado justificado': '00:00',
    'Tiempo no trabajado no justificado': '00:00',
    'Tasa ausentismo': 0,
    'Ver viatico': 0,
    'ObservaciÃ³n original': clean(asValue(rawRow, mapping, 'observaciones')),
    'ObservaciÃ³n procesada': reason,
    'Estado final': `Excluido de cÃ¡lculos - ${reason}`,
  };
}

function getAbsenceEquivalentMinutes(scheduleType, expectedMinutes) {
  if (
    scheduleType === SCHEDULE_TYPES.MODIFIED ||
    scheduleType === SCHEDULE_TYPES.MORNING_9_TO_3 ||
    scheduleType === SCHEDULE_TYPES.EVENING_3_TO_9 ||
    scheduleType === SCHEDULE_TYPES.MORNING_8_TO_2 ||
    scheduleType === SCHEDULE_TYPES.EVENING_2_TO_8
  ) {
    return expectedMinutes;
  }
  return scheduleType === SCHEDULE_TYPES.EXTENDED ? 11 * 60 : 8 * 60;
}

function getVacationEquivalentMinutes(scheduleType, expectedMinutes) {
  return scheduleType === SCHEDULE_TYPES.EXTENDED ? expectedMinutes : 8 * 60;
}

function getScheduledRecognizedMinutes({ entryMinutes, exitMinutes, entryExpected, exitExpected }) {
  if (
    entryMinutes === null ||
    exitMinutes === null ||
    entryExpected === null ||
    exitExpected === null
  ) {
    return 0;
  }

  const workedStart = Math.max(entryMinutes, entryExpected);
  const workedEnd = Math.min(exitMinutes, exitExpected);
  return Math.max(0, workedEnd - workedStart);
}

function finalizeMetricRow(row) {
  const {
    observacionesProcesadas,
    estados,
    horasEsperadasMin,
    horasTrabajadasRealesMin,
    horasTrabajadasReconocidasMin,
    tiempoTardanzaMin,
    tiempoTardanzaJustificadaMin,
    tiempoTardanzaNoJustificadaMin,
    tiempoSalidaTempranaMin,
    tiempoSalidaTempranaJustificadaMin,
    tiempoSalidaTempranaNoJustificadaMin,
    horasAusenciaMin,
    tiempoAusenciaJustificadaMin,
    tiempoAusenciaNoJustificadaMin,
    tiempoEventualidadJustificadaMin,
    tiempoNoTrabajadoJustificadoMin,
    tiempoNoTrabajadoNoJustificadoMin,
    ausenciasNoJustificadasFechas,
    ...publicRow
  } = row;
  const hourWorkedRate =
    horasEsperadasMin > 0 ? horasTrabajadasReconocidasMin / horasEsperadasMin : 0;
  const tasaAusentismo =
    horasEsperadasMin > 0 ? Math.max(0, 1 - hourWorkedRate) * 100 : 0;
  const maxAusenciasNoJustificadasConsecutivas =
    row.maxAusenciasNoJustificadasConsecutivas ??
    getMaxConsecutiveWorkdayAbsences(ausenciasNoJustificadasFechas, row.scheduleType);
  const disciplinarySummary = buildEmployeeDisciplinarySummary({
    ...row,
    tiempoTardanzaNoJustificadaMin,
    tiempoSalidaTempranaNoJustificadaMin,
    ausenciasNoJustificadasFechas,
    maxAusenciasNoJustificadasConsecutivas,
  });

  return {
    ...publicRow,
    diasATrabajar: Math.max(
      0,
      row.diasLaborables - row.vacaciones - row.ponchesIrregulares,
    ),
    horasEsperadas: minutesToHours(horasEsperadasMin),
    horasTrabajadasReales: minutesToHours(horasTrabajadasRealesMin),
    horasTrabajadasReconocidas: minutesToHours(horasTrabajadasReconocidasMin),
    horasReconocidas: minutesToHours(horasTrabajadasReconocidasMin),
    tiempoTardanza: formatMinutes(tiempoTardanzaMin),
    tiempoTardanzaJustificada: formatMinutes(tiempoTardanzaJustificadaMin),
    tiempoTardanzaNoJustificada: formatMinutes(tiempoTardanzaNoJustificadaMin),
    tiempoSalidaTemprana: formatMinutes(tiempoSalidaTempranaMin),
    tiempoSalidaTempranaJustificada: formatMinutes(tiempoSalidaTempranaJustificadaMin),
    tiempoSalidaTempranaNoJustificada: formatMinutes(tiempoSalidaTempranaNoJustificadaMin),
    tiempoAusenciaJustificada: formatMinutes(tiempoAusenciaJustificadaMin),
    tiempoAusenciaNoJustificada: formatMinutes(tiempoAusenciaNoJustificadaMin),
    tiempoEventualidadJustificada: formatMinutes(tiempoEventualidadJustificadaMin),
    tiempoNoTrabajadoJustificado: formatMinutes(tiempoNoTrabajadoJustificadoMin),
    tiempoNoTrabajadoNoJustificado: formatMinutes(tiempoNoTrabajadoNoJustificadoMin),
    tasaAusentismo: Number(tasaAusentismo.toFixed(2)),
    maxAusenciasNoJustificadasConsecutivas,
    categoriaDisciplinariaTardanzas: disciplinarySummary.tardanzas.label,
    colorDisciplinarioTardanzas: disciplinarySummary.tardanzas.colorName,
    categoriaDisciplinariaSalidasTempranas: disciplinarySummary.salidasTempranas.label,
    colorDisciplinarioSalidasTempranas: disciplinarySummary.salidasTempranas.colorName,
    categoriaDisciplinariaAusencias: disciplinarySummary.ausencias.label,
    colorDisciplinarioAusencias: disciplinarySummary.ausencias.colorName,
    disciplina: disciplinarySummary,
    observacionProcesada:
      observacionesProcesadas instanceof Set
        ? Array.from(observacionesProcesadas).filter(Boolean).join('; ')
        : row.observacionProcesada || '',
    estadoFinal:
      estados instanceof Set ? Array.from(estados).filter(Boolean).join('; ') : row.estadoFinal || '',
  };
}

function buildProcessedOutput(row, metrics) {
  return {
    NOMBRE: row.nombre,
    CODIGO: row.codigo,
    UBICACION: row.ubicacion,
    DEPARTAMENTO: row.departamento,
    CARGO: row.cargo,
    POSICION: row.posicion,
    CEDULA: row.cedula,
    'Fecha ingreso': row.fechaIngreso,
    FECHA: row.fecha,
    DIA: row.dia,
    'Tipo horario': row.tipoHorario,
    'Hora entrada': row.entradaRaw,
    'Hora salida': row.salidaRaw,
    'Tiempo observaciones': row.tiempoObservacionesRaw,
    'Eventualidad externa': row.externalEventualities
      ?.map((event) => event.tipoLabel || event.tipoOriginal)
      .join('; '),
    'Estado eventualidad externa': row.externalEventualities
      ?.map((event) => event.estadoOriginal)
      .filter(Boolean)
      .join('; '),
    'Comentario eventualidad externa': row.externalEventualities
      ?.map((event) => event.comentario)
      .filter(Boolean)
      .join('; '),
    'Tipos de eventualidad detectados': row.detectedEventTypes?.join('; '),
    'Tipos de eventualidad en asistencia': row.attendanceSourceTypes?.join('; '),
    'IDs eventualidades externas': row.externalEventualities?.map((event) => event.id).join('; '),
    'Eventualidad externa pendiente': row.externalEventualities?.some((event) => event.pendingTime)
      ? 'SI'
      : 'NO',
    'Horas esperadas': minutesToHours(metrics.horasEsperadasMin),
    'Horas trabajadas reales': minutesToHours(metrics.horasTrabajadasRealesMin),
    'Horas trabajadas reconocidas': minutesToHours(metrics.horasTrabajadasReconocidasMin),
    'Tiempo tardanza': formatMinutes(metrics.tiempoTardanzaMin),
    'Tiempo tardanza justificada': formatMinutes(metrics.tiempoTardanzaJustificadaMin),
    'Tiempo tardanza no justificada': formatMinutes(metrics.tiempoTardanzaNoJustificadaMin),
    'Tiempo salida temprana': formatMinutes(metrics.tiempoSalidaTempranaMin),
    'Tiempo salida temprana justificada': formatMinutes(
      metrics.tiempoSalidaTempranaJustificadaMin,
    ),
    'Tiempo salida temprana no justificada': formatMinutes(
      metrics.tiempoSalidaTempranaNoJustificadaMin,
    ),
    'Tiempo ausencia justificada': formatMinutes(metrics.tiempoAusenciaJustificadaMin),
    'Tiempo ausencia no justificada': formatMinutes(metrics.tiempoAusenciaNoJustificadaMin),
    'Tiempo no trabajado justificado': formatMinutes(metrics.tiempoNoTrabajadoJustificadoMin),
    'Tiempo no trabajado no justificado': formatMinutes(metrics.tiempoNoTrabajadoNoJustificadoMin),
    'Tasa ausentismo':
      metrics.horasEsperadasMin > 0
        ? Number(
            (
              Math.max(
                0,
                1 - metrics.horasTrabajadasReconocidasMin / metrics.horasEsperadasMin,
              ) * 100
            ).toFixed(2),
          )
        : 0,
    'Ver viatico': metrics.verViatico,
    'Observación original': row.observacionRaw,
    'Observación procesada': row.observacionProcesada,
    'Estado final': row.estadoFinal,
  };
}

export function evaluateAttendanceRow(rawRow, mapping, options = {}) {
  const defaultScheduleType = options.defaultScheduleType || DEFAULT_SCHEDULE_TYPE;
  const modifiedSchedule = options.modifiedSchedule;
  const scheduleType = detectScheduleType(
    rawRow,
    mapping,
    defaultScheduleType,
    options.extendedEmployeeCodes,
  );
  const schedule = getScheduleDefinition(scheduleType, modifiedSchedule);
  const dayIndex = getDayIndex({
    dayName: asValue(rawRow, mapping, 'dia'),
    dateValue: asValue(rawRow, mapping, 'fecha'),
  });
  const expectedWindow = getExpectedWindow(scheduleType, dayIndex, modifiedSchedule);
  const parsedDate = parseDateValue(asValue(rawRow, mapping, 'fecha'));
  const dateKey = parsedDate
    ? parsedDate.toISOString().slice(0, 10)
    : clean(asValue(rawRow, mapping, 'fecha'));
  const externalEventualities = findEventualitiesForRow(
    options.eventualitiesByCodeDate,
    asValue(rawRow, mapping, 'codigo'),
    dateKey,
  );
  const externalTypes = new Set(externalEventualities.map((event) => event.tipo).filter(Boolean));
  const entryExpected = parseClockToMinutes(expectedWindow.entry ?? schedule.defaultEntry);
  const exitExpected = parseClockToMinutes(expectedWindow.exit);
  const entryMinutes = parseClockToMinutes(asValue(rawRow, mapping, 'entrada'));
  const exitMinutes = parseClockToMinutes(asValue(rawRow, mapping, 'salida'));
  const observation = classifyObservation(asValue(rawRow, mapping, 'observaciones'));
  const externalPrimaryType = externalEventualities.find((event) => event.tipo)?.tipo ?? '';
  const hasVacationObservation = observation.matches.some((match) => match.id === 'vacacion');
  const externalTypesForClassification = hasVacationObservation ? new Set() : externalTypes;
  const hasExternalConfirmation = externalTypesForClassification.size > 0;
  const hasObservation = observation.isJustified || hasExternalConfirmation;
  const primaryId = externalPrimaryType || observation.primary?.id;
  const hasVerViatico =
    externalTypesForClassification.has(EVENTUALITY_TYPES.TRAVEL) ||
    observation.matches.some((match) => match.id === 'ver-viatico');
  const isHoliday =
    externalTypesForClassification.has(EVENTUALITY_TYPES.HOLIDAY) ||
    observation.matches.some((match) => match.id === 'feriado');
  const expectedMinutes = expectedWindow.expectedMinutes;
  const absenceEquivalentMinutes = getAbsenceEquivalentMinutes(scheduleType, expectedMinutes);
  const isWorkday = expectedWindow.isWorkday && !isHoliday;
  const isAbsent = isWorkday && entryMinutes === null && exitMinutes === null;
  const isIrregular =
    isWorkday && entryMinutes !== null && exitMinutes !== null && entryMinutes === exitMinutes;
  const hasValidPunchPair = isWorkday && entryMinutes !== null && exitMinutes !== null && !isIrregular;
  const realWorkedMinutes = hasValidPunchPair ? diffMinutes(entryMinutes, exitMinutes) : 0;
  const scheduledRecognizedMinutes = getScheduledRecognizedMinutes({
    entryMinutes,
    exitMinutes,
    entryExpected,
    exitExpected,
  });
  const recognizedMinutes = hasVerViatico
    ? expectedMinutes
    : Math.min(scheduledRecognizedMinutes, expectedMinutes);
  const isLate = !hasVerViatico && hasValidPunchPair && entryExpected !== null && entryMinutes > entryExpected;
  const lateMinutes = isLate ? entryMinutes - entryExpected : 0;
  const isEarlyExit = !hasVerViatico && hasValidPunchPair && exitExpected !== null && exitMinutes < exitExpected;
  const earlyExitMinutes = isEarlyExit ? exitExpected - exitMinutes : 0;
  const externalIsAuthoritative = externalTypesForClassification.size > 0;
  const isVacation = hasVacationObservation || (externalIsAuthoritative
    ? externalTypesForClassification.has(EVENTUALITY_TYPES.VACATION)
    : primaryId === 'vacacion');
  const isLicense = !isVacation && (externalIsAuthoritative
    ? externalTypesForClassification.has(EVENTUALITY_TYPES.LICENSE)
    : primaryId === 'licencia');
  const isPermit = !isVacation && (externalIsAuthoritative
    ? externalTypesForClassification.has(EVENTUALITY_TYPES.PERMIT)
    : primaryId === 'permiso');
  const isObservedAbsence = !isVacation && (externalIsAuthoritative
    ? externalTypesForClassification.has(EVENTUALITY_TYPES.ABSENCE)
    : primaryId === 'ausencia');
  const overridesIrregularPunch = hasVerViatico || isLicense || isPermit || isObservedAbsence;
  const hasTardinessObservation =
    externalTypesForClassification.has(EVENTUALITY_TYPES.TARDINESS) ||
    observation.matches.some((match) => match.id === 'tardanza');
  const hasEarlyExitConfirmation = externalTypesForClassification.has(EVENTUALITY_TYPES.EARLY_EXIT);
  const externalPermit = externalEventualities.find(
    (event) => event.tipo === EVENTUALITY_TYPES.PERMIT,
  );
  const permitObservationMinutes = isPermit
    ? parseDurationToMinutes(asValue(rawRow, mapping, 'tiempoObservaciones'))
    : 0;
  const externalPermitMinutes = externalPermit?.exactMinutes ?? 0;
  const externalPermitDayMinutes = externalPermit?.fullDayCount ? expectedMinutes : 0;
  const permitMinutes = isPermit
    ? externalPermitMinutes ||
      permitObservationMinutes ||
      externalPermitDayMinutes ||
      (isAbsent || isIrregular ? absenceEquivalentMinutes : 0)
    : 0;
  const hasAbsenceJustification =
    observation.isJustified ||
    externalTypesForClassification.has(EVENTUALITY_TYPES.ABSENCE) ||
    externalTypesForClassification.has(EVENTUALITY_TYPES.PERMIT) ||
    externalTypesForClassification.has(EVENTUALITY_TYPES.LICENSE);

  const metrics = createEmptyMetrics();
  const states = [];

  if (isHoliday) {
    states.push('Feriado');
  } else if (isWorkday) {
    metrics.diasLaborables = 1;
  }

  if (isHoliday) {
    metrics.horasEsperadasMin = 0;
    metrics.horasTrabajadasRealesMin = 0;
    metrics.horasTrabajadasReconocidasMin = 0;
  } else if (hasVerViatico && isWorkday) {
    metrics.horasEsperadasMin = expectedMinutes;
    metrics.diasTrabajadosCompletos = 1;
    metrics.horasTrabajadasRealesMin = realWorkedMinutes || expectedMinutes;
    metrics.horasTrabajadasReconocidasMin = expectedMinutes;
    metrics.verViatico = 1;
    metrics.tiempoNoTrabajadoJustificadoMin = 0;
    states.push('Trabajo externo / Ver viatico');
  } else if (isVacation && isWorkday) {
    metrics.vacaciones = 1;
    states.push('Vacacion justificada');
  } else if (isLicense && isWorkday) {
    metrics.licencias = 1;
    metrics.horasEsperadasMin = expectedMinutes;
    metrics.horasTrabajadasRealesMin = 0;
    metrics.horasTrabajadasReconocidasMin = 0;
    metrics.eventualidadesJustificadas = 1;
    metrics.tiempoEventualidadJustificadaMin += expectedMinutes;
    metrics.tiempoNoTrabajadoJustificadoMin += expectedMinutes;
    states.push('Licencia justificada');
  } else if (isIrregular && !overridesIrregularPunch) {
    metrics.ponchesIrregulares = 1;
    states.push('Pendiente revision - ponche irregular');
  } else {
    if (isWorkday) metrics.horasEsperadasMin = expectedMinutes;

    if (isPermit) {
      metrics.permisos = 1;
      if (permitMinutes > 0) {
        metrics.eventualidadesJustificadas = 1;
        metrics.tiempoEventualidadJustificadaMin += permitMinutes;
        metrics.tiempoNoTrabajadoJustificadoMin += permitMinutes;
        states.push('Permiso justificado');
      } else {
        states.push('Permiso registrado sin tiempo');
      }
    }

    if (isObservedAbsence && isWorkday) {
      metrics.ausenciasJustificadas = 1;
      metrics.horasAusenciaMin += absenceEquivalentMinutes;
      metrics.tiempoAusenciaJustificadaMin += absenceEquivalentMinutes;
      metrics.eventualidadesJustificadas = 1;
      metrics.tiempoEventualidadJustificadaMin += absenceEquivalentMinutes;
      metrics.tiempoNoTrabajadoJustificadoMin += absenceEquivalentMinutes;
      metrics.horasTrabajadasRealesMin = 0;
      metrics.horasTrabajadasReconocidasMin = 0;
      states.push('Ausencia justificada');
    } else if (isAbsent) {
      metrics.horasEsperadasMin = absenceEquivalentMinutes;
      if (isPermit && permitMinutes < absenceEquivalentMinutes) {
        const uncoveredAbsenceMinutes = absenceEquivalentMinutes - permitMinutes;
        metrics.ausenciasNoJustificadas = 1;
        metrics.horasAusenciaMin += uncoveredAbsenceMinutes;
        metrics.tiempoAusenciaNoJustificadaMin += uncoveredAbsenceMinutes;
        metrics.tiempoNoTrabajadoNoJustificadoMin += uncoveredAbsenceMinutes;
        states.push('Ausencia no justificada parcial');
      } else if (isPermit) {
        states.push('Ausencia cubierta por permiso');
      } else if (hasAbsenceJustification) {
        metrics.ausenciasJustificadas = 1;
        metrics.horasAusenciaMin += absenceEquivalentMinutes;
        metrics.tiempoAusenciaJustificadaMin += absenceEquivalentMinutes;
        if (!isPermit) {
          metrics.eventualidadesJustificadas = 1;
          metrics.tiempoEventualidadJustificadaMin += absenceEquivalentMinutes;
          metrics.tiempoNoTrabajadoJustificadoMin += absenceEquivalentMinutes;
        }
        states.push(`Ausencia justificada - ${observation.primary?.category ?? 'observacion'}`);
      } else {
        metrics.ausenciasNoJustificadas = 1;
        metrics.horasAusenciaMin += absenceEquivalentMinutes;
        metrics.tiempoAusenciaNoJustificadaMin += absenceEquivalentMinutes;
        metrics.tiempoNoTrabajadoNoJustificadoMin += absenceEquivalentMinutes;
        states.push('Ausencia no justificada');
      }
    } else if (isIrregular && overridesIrregularPunch) {
      metrics.horasEsperadasMin = expectedMinutes;
      metrics.horasTrabajadasRealesMin = 0;
      metrics.horasTrabajadasReconocidasMin = 0;
      states.push(`Ponche irregular reclasificado - ${observation.primary?.category ?? 'observacion'}`);
    } else if (hasValidPunchPair) {
      metrics.horasTrabajadasRealesMin = realWorkedMinutes;
      metrics.horasTrabajadasReconocidasMin = isPermit
        ? Math.min(recognizedMinutes, Math.max(0, expectedMinutes - permitMinutes))
        : recognizedMinutes;

      if (realWorkedMinutes > 0) {
        metrics.diasTrabajadosCompletos = 1;
        if (
          metrics.horasTrabajadasReconocidasMin >= expectedMinutes &&
          lateMinutes === 0 &&
          earlyExitMinutes === 0
        ) {
          states.push('Dia trabajado completo');
        } else {
          states.push('Dia trabajado');
        }
      }

      if (isLate) {
        metrics.tiempoTardanzaMin += lateMinutes;
        if (hasTardinessObservation) {
          metrics.tardanzasJustificadas = 1;
          metrics.tiempoTardanzaJustificadaMin += lateMinutes;
          metrics.tiempoNoTrabajadoJustificadoMin += lateMinutes;
          states.push('Tardanza justificada');
        } else {
          metrics.tardanzasNoJustificadas = 1;
          metrics.tiempoTardanzaNoJustificadaMin += lateMinutes;
          metrics.tiempoNoTrabajadoNoJustificadoMin += lateMinutes;
          states.push('Tardanza no justificada');
        }
      }

      if (isEarlyExit && !isPermit) {
        metrics.tiempoSalidaTempranaMin += earlyExitMinutes;
        if (hasEarlyExitConfirmation || observation.isJustified) {
          metrics.salidasTempranasJustificadas = 1;
          metrics.tiempoSalidaTempranaJustificadaMin += earlyExitMinutes;
          metrics.tiempoNoTrabajadoJustificadoMin += earlyExitMinutes;
          states.push('Salida temprana justificada');
        } else {
          metrics.salidasTempranasNoJustificadas = 1;
          metrics.tiempoSalidaTempranaNoJustificadaMin += earlyExitMinutes;
          metrics.tiempoNoTrabajadoNoJustificadoMin += earlyExitMinutes;
          states.push('Salida temprana no justificada');
        }
      }
    } else if (isWorkday) {
      metrics.ponchesIrregulares = 1;
      metrics.horasEsperadasMin = 0;
      states.push('Pendiente revision - ponche incompleto');
    }
  }

  const observationTypeMap = {
    vacacion: EVENTUALITY_TYPES.VACATION,
    licencia: EVENTUALITY_TYPES.LICENSE,
    permiso: EVENTUALITY_TYPES.PERMIT,
    ausencia: EVENTUALITY_TYPES.ABSENCE,
    tardanza: EVENTUALITY_TYPES.TARDINESS,
    'ver-viatico': EVENTUALITY_TYPES.TRAVEL,
    feriado: EVENTUALITY_TYPES.HOLIDAY,
  };
  const attendanceSourceTypes = new Set(
    observation.matches.map((match) => observationTypeMap[match.id]).filter(Boolean),
  );
  if (isLate) attendanceSourceTypes.add(EVENTUALITY_TYPES.TARDINESS);
  if (isEarlyExit) attendanceSourceTypes.add(EVENTUALITY_TYPES.EARLY_EXIT);
  if (!hasVerViatico && isAbsent && !attendanceSourceTypes.size) {
    attendanceSourceTypes.add(EVENTUALITY_TYPES.ABSENCE);
  }
  if (!hasVerViatico && isIrregular && !attendanceSourceTypes.size) {
    attendanceSourceTypes.add(EVENTUALITY_TYPES.IRREGULAR_PUNCH);
  }
  const detectedEventTypes = [
    metrics.vacaciones ? EVENTUALITY_TYPES.VACATION : '',
    metrics.licencias ? EVENTUALITY_TYPES.LICENSE : '',
    metrics.permisos ? EVENTUALITY_TYPES.PERMIT : '',
    metrics.ausenciasJustificadas || metrics.ausenciasNoJustificadas
      ? EVENTUALITY_TYPES.ABSENCE
      : '',
    metrics.tardanzasJustificadas || metrics.tardanzasNoJustificadas
      ? EVENTUALITY_TYPES.TARDINESS
      : '',
    metrics.salidasTempranasJustificadas || metrics.salidasTempranasNoJustificadas
      ? EVENTUALITY_TYPES.EARLY_EXIT
      : '',
    metrics.ponchesIrregulares ? EVENTUALITY_TYPES.IRREGULAR_PUNCH : '',
    metrics.verViatico ? EVENTUALITY_TYPES.TRAVEL : '',
    isHoliday ? EVENTUALITY_TYPES.HOLIDAY : '',
  ].filter(Boolean);
  const displayExternalEventualities = externalEventualities.filter(
    (event) => !NON_EVENTUALITY_TYPES.has(event.tipo),
  );
  const externalLabels = displayExternalEventualities.map((event) => event.tipoLabel || event.tipoOriginal);
  const displayRow = {
    codigo: clean(asValue(rawRow, mapping, 'codigo')),
    nombre: clean(asValue(rawRow, mapping, 'nombre')),
    ubicacion: clean(asValue(rawRow, mapping, 'ubicacion')) || 'Sin ubicacion',
    departamento: clean(asValue(rawRow, mapping, 'departamento')),
    fecha: parsedDate ? parsedDate.toISOString().slice(0, 10) : clean(asValue(rawRow, mapping, 'fecha')),
    dia: clean(asValue(rawRow, mapping, 'dia')),
    tipoHorario: schedule.label,
    scheduleType,
    entradaRaw: clean(asValue(rawRow, mapping, 'entrada')),
    salidaRaw: clean(asValue(rawRow, mapping, 'salida')),
    tiempoObservacionesRaw: clean(asValue(rawRow, mapping, 'tiempoObservaciones')),
    observacionRaw: observation.raw,
    observacionProcesada: [
      observation.processedLabel,
      externalLabels.length ? `Confirmado por Excel de eventualidades: ${externalLabels.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('; '),
    estadoFinal: states.join('; ') || (isWorkday ? 'Sin eventualidad' : 'Dia no laborable'),
    eventualidadJustificada: metrics.eventualidadesJustificadas > 0,
    detectedEventTypes: detectedEventTypes.filter((type) => !NON_EVENTUALITY_TYPES.has(type)),
    attendanceSourceTypes: Array.from(attendanceSourceTypes).filter(
      (type) => !NON_EVENTUALITY_TYPES.has(type),
    ),
    externalEventualities: displayExternalEventualities,
    metricFlags: metrics,
  };

  return {
    row: displayRow,
    metrics,
    processedRow: buildProcessedOutput(displayRow, metrics),
    events: {
      tardanza: metrics.tardanzasJustificadas || metrics.tardanzasNoJustificadas,
      salidaTemprana: metrics.salidasTempranasJustificadas || metrics.salidasTempranasNoJustificadas,
      ausencia: metrics.ausenciasJustificadas || metrics.ausenciasNoJustificadas,
      vacacion: metrics.vacaciones,
      poncheIrregular: metrics.ponchesIrregulares,
      eventualidadJustificada: metrics.eventualidadesJustificadas > 0,
    },
  };
}

export function processAttendanceRows(rows = [], mapping = {}, options = {}) {
  const extendedEmployeeCodes = new Set(options.extendedEmployeeCodes ?? []);
  const payrollEmployeesByCode = options.payrollEmployeesByCode ?? {};
  const hasPayrollRecords = Object.keys(payrollEmployeesByCode).length > 0;
  const missingPayrollEmployees = new Map();
  const employees = new Map();
  const locations = new Map();
  const schedules = new Map();
  const processedRows = [];
  let excludedRowsByPayroll = 0;
  const payrollExclusionSummary = {
    totalRows: 0,
    byPositionRows: 0,
    byHierarchyPositionRows: 0,
    byHireDateRows: 0,
    beforeHireDateRows: 0,
  };
  const events = {
    tardanzas: [],
    salidasTempranas: [],
    ausencias: [],
    vacaciones: [],
    ponchesIrregulares: [],
    eventualidadesJustificadas: [],
  };

  function registerMissingPayrollEmployee(rawRow, index, rawCode) {
    if (!hasPayrollRecords || !rawCode) return false;
    const current = missingPayrollEmployees.get(rawCode) ?? {
      codigo: rawCode,
      nombre: clean(asValue(rawRow, mapping, 'nombre')),
      ubicacion: clean(asValue(rawRow, mapping, 'ubicacion')),
      firstRow: index + 1,
      rowCount: 0,
    };
    current.nombre = current.nombre || clean(asValue(rawRow, mapping, 'nombre'));
    current.ubicacion = current.ubicacion || clean(asValue(rawRow, mapping, 'ubicacion'));
    current.rowCount += 1;
    missingPayrollEmployees.set(rawCode, current);
    return true;
  }

  rows.forEach((rawRow, index) => {
    const rawCode = clean(asValue(rawRow, mapping, 'codigo'));
    const payrollRecord = findPayrollRecord(payrollEmployeesByCode, rawCode);
    const isMissingFromPayroll = !payrollRecord && registerMissingPayrollEmployee(rawRow, index, rawCode);
    const isBeforePayrollHireDate = isBeforeHireDate(rawRow, mapping, payrollRecord);
    if (payrollRecord?.excluded) {
      excludedRowsByPayroll += 1;
      payrollExclusionSummary.totalRows += 1;
      if (payrollRecord.excludedByPosition) payrollExclusionSummary.byPositionRows += 1;
      if (payrollRecord.excludedByHierarchyPosition) payrollExclusionSummary.byHierarchyPositionRows += 1;
      if (payrollRecord.excludedByHireDate) payrollExclusionSummary.byHireDateRows += 1;
      processedRows.push({
        '#': index + 1,
        NOMBRE: payrollRecord.nombre || clean(asValue(rawRow, mapping, 'nombre')),
        CODIGO: rawCode,
        UBICACION: payrollRecord.ubicacion || clean(asValue(rawRow, mapping, 'ubicacion')) || 'Sin ubicacion',
        DEPARTAMENTO: payrollRecord.ubicacion || '',
        CARGO: payrollRecord.cargo || '',
        POSICION: payrollRecord.posicion || '',
        CEDULA: payrollRecord.cedula || '',
        'Fecha ingreso': payrollRecord.fechaIngreso || '',
        FECHA: clean(asValue(rawRow, mapping, 'fecha')),
        DIA: clean(asValue(rawRow, mapping, 'dia')),
        'Tipo horario': '',
        'Hora entrada': clean(asValue(rawRow, mapping, 'entrada')),
        'Hora salida': clean(asValue(rawRow, mapping, 'salida')),
        'Tiempo observaciones': clean(asValue(rawRow, mapping, 'tiempoObservaciones')),
        'Horas esperadas': 0,
        'Horas trabajadas reales': 0,
        'Horas trabajadas reconocidas': 0,
        'Tiempo tardanza': '00:00',
        'Tiempo salida temprana': '00:00',
        'Tiempo no trabajado justificado': '00:00',
        'Tiempo no trabajado no justificado': '00:00',
        'Tasa ausentismo': 0,
        'Ver viatico': 0,
        'Observación original': clean(asValue(rawRow, mapping, 'observaciones')),
        'Observación procesada': payrollRecord.exclusionReason,
        'Estado final': `Excluido de cálculos - ${payrollRecord.exclusionReason}`,
      });
      return;
    }
    if (isBeforePayrollHireDate) {
      const reason = 'Marca anterior a la fecha de ingreso';
      excludedRowsByPayroll += 1;
      payrollExclusionSummary.totalRows += 1;
      payrollExclusionSummary.beforeHireDateRows += 1;
      processedRows.push(buildExcludedPayrollProcessedRow({
        rawRow,
        mapping,
        index,
        rawCode,
        payrollRecord,
        reason,
      }));
      return;
    }

    const result = evaluateAttendanceRow(rawRow, mapping, {
      ...options,
      extendedEmployeeCodes,
    });
    const { row, metrics, processedRow } = result;
    if (!row.codigo && !row.nombre) return;

    if (payrollRecord) {
      row.nombre = payrollRecord.nombre || row.nombre;
      row.ubicacion = payrollRecord.ubicacion || row.ubicacion;
      row.departamento = payrollRecord.ubicacion || row.departamento;
      row.cargo = payrollRecord.cargo || '';
      row.posicion = payrollRecord.posicion || '';
      row.cedula = payrollRecord.cedula || '';
      row.fechaIngreso = payrollRecord.fechaIngreso || '';
      processedRow.NOMBRE = row.nombre;
      processedRow.UBICACION = row.ubicacion;
      processedRow.DEPARTAMENTO = row.departamento;
      processedRow.CARGO = row.cargo;
      processedRow.POSICION = row.posicion;
      processedRow.CEDULA = row.cedula;
      processedRow['Fecha ingreso'] = row.fechaIngreso;
    }
    if (isMissingFromPayroll) {
      const alert = 'No encontrado en nómina';
      processedRow['Alerta nómina'] = alert;
      processedRow['Observación procesada'] = [processedRow['Observación procesada'], alert]
        .filter(Boolean)
        .join('; ');
    }

    const employeeKey = `${row.ubicacion}::${row.codigo}::${row.nombre}`;
    if (!employees.has(employeeKey)) {
      employees.set(employeeKey, createEmployeeRecord({
        ...row,
        modifiedSchedule: options.modifiedSchedule,
      }));
    }

    const employee = employees.get(employeeKey);
    addMetrics(employee, metrics);
    if (metrics.ausenciasNoJustificadas > 0 && row.fecha) {
      employee.ausenciasNoJustificadasFechas.push(row.fecha);
    }
    employee.observacionesProcesadas.add(row.observacionProcesada);
    employee.estados.add(row.estadoFinal);

    const locationKey = row.ubicacion || 'Sin ubicacion';
    if (!locations.has(locationKey)) {
      locations.set(locationKey, {
        ubicacion: locationKey,
        tipo: 'subtotal_ubicacion',
        ...createEmptyMetrics(),
      });
    }
    addMetrics(locations.get(locationKey), metrics);

    const scheduleKey = row.tipoHorario;
    if (!schedules.has(scheduleKey)) {
      schedules.set(scheduleKey, {
        tipoHorario: scheduleKey,
        ...createEmptyMetrics(),
      });
    }
    addMetrics(schedules.get(scheduleKey), metrics);

    if (result.events.tardanza) addEvent(events, 'tardanzas', processedRow);
    if (result.events.salidaTemprana) addEvent(events, 'salidasTempranas', processedRow);
    if (result.events.ausencia) addEvent(events, 'ausencias', processedRow);
    if (result.events.vacacion) addEvent(events, 'vacaciones', processedRow);
    if (result.events.poncheIrregular) addEvent(events, 'ponchesIrregulares', processedRow);
    if (result.events.eventualidadJustificada) events.eventualidadesJustificadas.push(processedRow);

    processedRows.push({
      '#': index + 1,
      ...processedRow,
    });
  });

  const summaryGeneralAccumulator = {
    alcance: 'Total general',
    ...createEmptyMetrics(),
  };

  employees.forEach((employee) => addMetrics(summaryGeneralAccumulator, employee));

  const employeeSummary = Array.from(employees.values())
    .map(finalizeMetricRow)
    .sort((a, b) => `${a.ubicacion}${a.nombre}`.localeCompare(`${b.ubicacion}${b.nombre}`));

  const locationSummary = Array.from(locations.values())
    .map(finalizeMetricRow)
    .sort((a, b) => a.ubicacion.localeCompare(b.ubicacion));

  const scheduleSummary = Array.from(schedules.values()).map(finalizeMetricRow);
  const missingPayrollList = Array.from(missingPayrollEmployees.values()).sort((a, b) =>
    String(a.codigo).localeCompare(String(b.codigo), 'es'),
  );
  const missingPayrollWarnings = missingPayrollList.slice(0, 20).map((employee) =>
    `Código ${employee.codigo} no aparece en nómina (${employee.nombre || 'sin nombre'}, fila ${employee.firstRow}, ${employee.rowCount} registro(s)).`,
  );
  if (missingPayrollList.length > missingPayrollWarnings.length) {
    missingPayrollWarnings.push(
      `Hay ${(missingPayrollList.length - missingPayrollWarnings.length).toLocaleString('es-DO')} código(s) adicional(es) del ponchado que no aparecen en nómina.`,
    );
  }

  return {
    processedRows,
    summaryGeneral: finalizeMetricRow(summaryGeneralAccumulator),
    summaryByLocation: locationSummary,
    summaryByEmployee: employeeSummary,
    summaryBySchedule: scheduleSummary,
    events,
    metadata: {
      totalRows: rows.length,
      processedRows: processedRows.length,
      excludedRowsByPayroll,
      payrollExclusionSummary,
      missingPayrollEmployees: missingPayrollList,
      missingPayrollSummary: {
        totalEmployees: missingPayrollList.length,
        totalRows: missingPayrollList.reduce((total, employee) => total + employee.rowCount, 0),
      },
      warnings: missingPayrollWarnings,
      generatedAt: new Date().toISOString(),
    },
  };
}
