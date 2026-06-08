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
  buildEmployeeDisciplinarySummary,
  getMaxConsecutiveWorkdayAbsences,
} from './disciplinaryRules.js';

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

function detectScheduleType(row, mapping, defaultScheduleType, extendedEmployeeCodes) {
  const codeKeys = getEmployeeCodeKeys(asValue(row, mapping, 'codigo'));
  const raw = clean(asValue(row, mapping, 'tipoHorario')).toLowerCase();
  if (raw.includes('extend')) return SCHEDULE_TYPES.EXTENDED;
  if (raw.includes('modif')) return SCHEDULE_TYPES.MODIFIED;
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

function getAbsenceEquivalentMinutes(scheduleType, expectedMinutes) {
  if (scheduleType === SCHEDULE_TYPES.MODIFIED) return expectedMinutes;
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
    'Horas esperadas': minutesToHours(metrics.horasEsperadasMin),
    'Horas trabajadas reales': minutesToHours(metrics.horasTrabajadasRealesMin),
    'Horas trabajadas reconocidas': minutesToHours(metrics.horasTrabajadasReconocidasMin),
    'Tiempo tardanza': formatMinutes(metrics.tiempoTardanzaMin),
    'Tiempo salida temprana': formatMinutes(metrics.tiempoSalidaTempranaMin),
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
  const entryExpected = parseClockToMinutes(expectedWindow.entry ?? schedule.defaultEntry);
  const exitExpected = parseClockToMinutes(expectedWindow.exit);
  const entryMinutes = parseClockToMinutes(asValue(rawRow, mapping, 'entrada'));
  const exitMinutes = parseClockToMinutes(asValue(rawRow, mapping, 'salida'));
  const observation = classifyObservation(asValue(rawRow, mapping, 'observaciones'));
  const hasObservation = observation.isJustified;
  const primaryId = observation.primary?.id;
  const hasVerViatico = observation.matches.some((match) => match.id === 'ver-viatico');
  const isHoliday = observation.matches.some((match) => match.id === 'feriado');
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
  const isLate = hasValidPunchPair && entryExpected !== null && entryMinutes > entryExpected;
  const lateMinutes = isLate ? entryMinutes - entryExpected : 0;
  const isEarlyExit = hasValidPunchPair && exitExpected !== null && exitMinutes < exitExpected;
  const earlyExitMinutes = isEarlyExit ? exitExpected - exitMinutes : 0;
  const isVacation = primaryId === 'vacacion';
  const isLicense = primaryId === 'licencia';
  const isPermit = primaryId === 'permiso';
  const isObservedAbsence = primaryId === 'ausencia';
  const overridesIrregularPunch = isLicense || isPermit || isObservedAbsence;
  const hasTardinessObservation = observation.matches.some((match) => match.id === 'tardanza');
  const permitObservationMinutes = isPermit
    ? parseDurationToMinutes(asValue(rawRow, mapping, 'tiempoObservaciones'))
    : 0;
  const permitMinutes = isPermit
    ? permitObservationMinutes || (isAbsent || isIrregular ? absenceEquivalentMinutes : 0)
    : 0;

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
  } else if (hasVerViatico && isWorkday) {
    metrics.horasEsperadasMin = expectedMinutes;
    metrics.diasTrabajadosCompletos = 1;
    metrics.horasTrabajadasRealesMin = realWorkedMinutes || expectedMinutes;
    metrics.horasTrabajadasReconocidasMin = expectedMinutes;
    metrics.verViatico = 1;
    metrics.tiempoNoTrabajadoJustificadoMin = 0;
    states.push('Trabajo externo / Ver viatico');
  } else {
    if (isWorkday) metrics.horasEsperadasMin = expectedMinutes;

    if (isPermit) {
      metrics.permisos = 1;
      metrics.eventualidadesJustificadas = 1;
      metrics.tiempoEventualidadJustificadaMin += permitMinutes;
      metrics.tiempoNoTrabajadoJustificadoMin += permitMinutes;
      states.push('Permiso justificado');
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
      } else if (hasObservation) {
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
      metrics.horasTrabajadasReconocidasMin = Math.max(0, recognizedMinutes - permitMinutes);

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
        if (hasObservation) {
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

  const parsedDate = parseDateValue(asValue(rawRow, mapping, 'fecha'));
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
    observacionProcesada: observation.processedLabel,
    estadoFinal: states.join('; ') || (isWorkday ? 'Sin eventualidad' : 'Dia no laborable'),
    eventualidadJustificada: hasObservation,
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
  const employees = new Map();
  const locations = new Map();
  const schedules = new Map();
  const processedRows = [];
  let excludedRowsByPayroll = 0;
  const events = {
    tardanzas: [],
    salidasTempranas: [],
    ausencias: [],
    vacaciones: [],
    ponchesIrregulares: [],
    eventualidadesJustificadas: [],
  };

  rows.forEach((rawRow, index) => {
    const rawCode = clean(asValue(rawRow, mapping, 'codigo'));
    const payrollRecord = findPayrollRecord(payrollEmployeesByCode, rawCode);
    if (payrollRecord?.excluded) {
      excludedRowsByPayroll += 1;
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
      generatedAt: new Date().toISOString(),
    },
  };
}
