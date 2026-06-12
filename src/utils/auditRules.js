import { refreshEventualityReconciliation } from './eventualitiesReader.js';

const TIME_FIELDS = [
  'tiempoTardanza',
  'tiempoTardanzaJustificada',
  'tiempoTardanzaNoJustificada',
  'tiempoSalidaTemprana',
  'tiempoSalidaTempranaJustificada',
  'tiempoSalidaTempranaNoJustificada',
  'tiempoAusenciaJustificada',
  'tiempoAusenciaNoJustificada',
  'tiempoEventualidadJustificada',
  'tiempoNoTrabajadoJustificado',
  'tiempoNoTrabajadoNoJustificado',
];

const NUMBER_FIELDS = [
  'diasLaborables',
  'diasATrabajar',
  'diasTrabajadosCompletos',
  'vacaciones',
  'licencias',
  'permisos',
  'ausenciasJustificadas',
  'ausenciasNoJustificadas',
  'tardanzasJustificadas',
  'tardanzasNoJustificadas',
  'salidasTempranasJustificadas',
  'salidasTempranasNoJustificadas',
  'ponchesIrregulares',
  'horasEsperadas',
  'horasTrabajadasReales',
  'horasTrabajadasReconocidas',
  'horasReconocidas',
  'verViatico',
];

function cleanNumber(value = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function parseDurationToMinutes(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 60);
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const match = raw.match(/^(-)?(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (!match) return 0;
  const sign = match[1] ? -1 : 1;
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  return sign * (hours * 60 + minutes + Math.round(seconds / 60));
}

export function formatMinutes(totalMinutes = 0) {
  const sign = totalMinutes < 0 ? '-' : '';
  const safeMinutes = Math.abs(Math.round(Number(totalMinutes || 0)));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

function hoursToMinutes(value) {
  return Math.round(cleanNumber(value) * 60);
}

function minutesToHours(value) {
  return Math.round((Number(value || 0) / 60) * 100) / 100;
}

function employeeKey(row = {}) {
  return [
    row.ubicacion ?? row.UBICACION ?? '',
    row.codigo ?? row.CODIGO ?? '',
    row.nombre ?? row.NOMBRE ?? '',
  ].map((value) => String(value ?? '').trim()).join('::');
}

function processedRowValue(row, field) {
  return row?.[field] ?? '';
}

function buildDailyAuditDetail(row) {
  const expectedMin = hoursToMinutes(processedRowValue(row, 'Horas esperadas'));
  const recognizedMin = hoursToMinutes(processedRowValue(row, 'Horas trabajadas reconocidas'));
  const justifiedMin = parseDurationToMinutes(processedRowValue(row, 'Tiempo no trabajado justificado'));
  const unjustifiedMin = parseDurationToMinutes(processedRowValue(row, 'Tiempo no trabajado no justificado'));
  const explainedMin = recognizedMin + justifiedMin + unjustifiedMin;
  const differenceMin = expectedMin - explainedMin;
  const state = String(processedRowValue(row, 'Estado final') || '');
  const observation = String(processedRowValue(row, 'Observación original') || '');
  const reviewHints = [];

  if (differenceMin > 0) {
    reviewHints.push('Falta tiempo por clasificar en este día.');
  }
  if (differenceMin < 0) {
    reviewHints.push('El tiempo explicado excede las horas esperadas del día.');
  }
  if (expectedMin > 0 && recognizedMin === 0 && justifiedMin === 0 && unjustifiedMin === 0) {
    reviewHints.push('Día exigible sin horas reconocidas ni tiempo no trabajado.');
  }
  if (/permiso/i.test(observation) && !processedRowValue(row, 'Tiempo observaciones')) {
    reviewHints.push('Permiso sin tiempo de observación registrado.');
  }
  if (/ponche irregular|ponche incompleto/i.test(state)) {
    reviewHints.push('Ponche pendiente de revisión.');
  }
  if (/tardanza no justificada/i.test(state)) {
    reviewHints.push('Tardanza no justificada detectada.');
  }
  if (/salida temprana no justificada/i.test(state)) {
    reviewHints.push('Salida temprana no justificada detectada.');
  }
  if (/ausencia no justificada/i.test(state)) {
    reviewHints.push('Ausencia no justificada detectada.');
  }

  return {
    fila: processedRowValue(row, '#'),
    fecha: processedRowValue(row, 'FECHA'),
    dia: processedRowValue(row, 'DIA'),
    entrada: processedRowValue(row, 'Hora entrada') || 'vacía',
    salida: processedRowValue(row, 'Hora salida') || 'vacía',
    observacion: observation || 'vacía',
    tiempoObservaciones: processedRowValue(row, 'Tiempo observaciones') || 'vacío',
    horasEsperadas: formatMinutes(expectedMin),
    horasReconocidas: formatMinutes(recognizedMin),
    tiempoJustificado: processedRowValue(row, 'Tiempo no trabajado justificado'),
    tiempoNoJustificado: processedRowValue(row, 'Tiempo no trabajado no justificado'),
    totalCalculado: formatMinutes(explainedMin),
    diferenciaMin: differenceMin,
    diferencia: formatMinutes(differenceMin),
    estadoFinal: state || 'Sin estado',
    posibleFallo: reviewHints[0] ?? 'Revisar clasificación del día.',
    pistas: reviewHints,
  };
}

function buildDailyAuditDetails(processedRows = [], employeeDifferenceMin = 0) {
  const details = processedRows.map(buildDailyAuditDetail);
  const directFindings = details.filter((detail) => detail.diferenciaMin !== 0);
  if (directFindings.length) {
    return directFindings.sort(
      (a, b) => Math.abs(b.diferenciaMin) - Math.abs(a.diferenciaMin),
    );
  }

  const relevantPattern =
    employeeDifferenceMin > 0
      ? /sin horas reconocidas|permiso sin tiempo|ausencia|ponche/i
      : /excede|permiso|licencia|ausencia|tardanza|salida/i;

  return details
    .filter((detail) =>
      detail.pistas.some((hint) => relevantPattern.test(hint)) ||
      relevantPattern.test(detail.estadoFinal),
    )
    .sort((a, b) => {
      const aImpact =
        parseDurationToMinutes(a.tiempoJustificado) + parseDurationToMinutes(a.tiempoNoJustificado);
      const bImpact =
        parseDurationToMinutes(b.tiempoJustificado) + parseDurationToMinutes(b.tiempoNoJustificado);
      return bImpact - aImpact;
    })
    .slice(0, 5);
}

export function auditEmployee(employee, processedRows = []) {
  const expectedMin = hoursToMinutes(employee.horasEsperadas);
  const recognizedMin = hoursToMinutes(
    employee.horasReconocidas ?? employee.horasTrabajadasReconocidas,
  );
  const justifiedMin = parseDurationToMinutes(employee.tiempoNoTrabajadoJustificado);
  const unjustifiedMin = parseDurationToMinutes(employee.tiempoNoTrabajadoNoJustificado);
  const explainedMin = recognizedMin + justifiedMin + unjustifiedMin;
  const differenceMin = expectedMin - explainedMin;
  const detalles = buildDailyAuditDetails(processedRows, differenceMin);
  const status =
    differenceMin === 0
      ? 'Cuadrado'
      : differenceMin > 0
        ? 'Requiere revisión - falta tiempo'
        : 'Requiere revisión - tiempo excedido';

  return {
    codigo: employee.codigo,
    nombre: employee.nombre,
    ubicacion: employee.ubicacion,
    tipoHorario: employee.tipoHorario,
    horasEsperadas: employee.horasEsperadas,
    horasReconocidas: employee.horasReconocidas ?? employee.horasTrabajadasReconocidas,
    tiempoNoTrabajadoJustificado: employee.tiempoNoTrabajadoJustificado,
    tiempoNoTrabajadoNoJustificado: employee.tiempoNoTrabajadoNoJustificado,
    totalCalculado: formatMinutes(explainedMin),
    diferenciaMin: differenceMin,
    diferencia: formatMinutes(differenceMin),
    estadoCuadre: status,
    requiereRevision: differenceMin !== 0,
    detalles,
    posibleCausa:
      detalles[0]?.posibleFallo ??
      (differenceMin > 0
        ? 'Falta clasificar tiempo no trabajado.'
        : differenceMin < 0
          ? 'El tiempo explicado supera las horas esperadas.'
          : 'Sin descuadre.'),
  };
}

export function auditResult(result) {
  const employees = result?.summaryByEmployee ?? [];
  const processedRowsByEmployee = (result?.processedRows ?? []).reduce((map, row) => {
    const key = employeeKey(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
    return map;
  }, new Map());
  const employeeAudits = employees.map((employee) =>
    auditEmployee(employee, processedRowsByEmployee.get(employeeKey(employee)) ?? []),
  );
  const pendingEmployees = employeeAudits.filter((row) => row.requiereRevision);
  const general = buildGeneralAudit(employeeAudits);
  const eventuality = refreshEventualityReconciliation(result?.eventualityAudit);
  const hasEventualityDifferences = Boolean(eventuality.enabled && eventuality.pendingItems.length);

  return {
    employeeAudits,
    pendingEmployees,
    general,
    eventuality,
    hasDiscrepancies:
      hasEventualityDifferences || pendingEmployees.length > 0 || general.diferenciaMin !== 0,
  };
}

function buildGeneralAudit(employeeAudits = []) {
  const totals = employeeAudits.reduce(
    (acc, row) => {
      acc.horasEsperadasMin += hoursToMinutes(row.horasEsperadas);
      acc.horasReconocidasMin += hoursToMinutes(row.horasReconocidas);
      acc.tiempoJustificadoMin += parseDurationToMinutes(row.tiempoNoTrabajadoJustificado);
      acc.tiempoNoJustificadoMin += parseDurationToMinutes(row.tiempoNoTrabajadoNoJustificado);
      acc.diferenciaMin += row.diferenciaMin;
      return acc;
    },
    {
      horasEsperadasMin: 0,
      horasReconocidasMin: 0,
      tiempoJustificadoMin: 0,
      tiempoNoJustificadoMin: 0,
      diferenciaMin: 0,
    },
  );
  const totalCalculadoMin =
    totals.horasReconocidasMin + totals.tiempoJustificadoMin + totals.tiempoNoJustificadoMin;

  return {
    totalEmpleados: employeeAudits.length,
    empleadosCuadrados: employeeAudits.filter((row) => !row.requiereRevision).length,
    empleadosConDescuadre: employeeAudits.filter((row) => row.requiereRevision).length,
    horasEsperadas: minutesToHours(totals.horasEsperadasMin),
    horasReconocidas: minutesToHours(totals.horasReconocidasMin),
    tiempoNoTrabajadoJustificado: formatMinutes(totals.tiempoJustificadoMin),
    tiempoNoTrabajadoNoJustificado: formatMinutes(totals.tiempoNoJustificadoMin),
    totalCalculado: formatMinutes(totalCalculadoMin),
    diferenciaMin: totals.diferenciaMin,
    diferencia: formatMinutes(totals.diferenciaMin),
    estadoCuadre: totals.diferenciaMin === 0 ? 'Cuadrado' : 'Requiere revisión',
  };
}

function aggregateRows(rows, base = {}) {
  const aggregate = { ...base };

  NUMBER_FIELDS.forEach((field) => {
    aggregate[field] = rows.reduce((total, row) => total + cleanNumber(row[field]), 0);
  });
  TIME_FIELDS.forEach((field) => {
    aggregate[field] = formatMinutes(
      rows.reduce((total, row) => total + parseDurationToMinutes(row[field]), 0),
    );
  });

  aggregate.horasReconocidas = aggregate.horasReconocidas || aggregate.horasTrabajadasReconocidas;
  const expectedMin = hoursToMinutes(aggregate.horasEsperadas);
  const recognizedMin = hoursToMinutes(aggregate.horasReconocidas);
  aggregate.tasaAusentismo =
    expectedMin > 0 ? Number((Math.max(0, 1 - recognizedMin / expectedMin) * 100).toFixed(2)) : 0;

  return aggregate;
}

function groupRows(rows, getKey) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = getKey(row) || 'Sin ubicacion';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return Array.from(groups.entries());
}

function matchesAffectedEmployee(row, affectedEmployee) {
  if (!affectedEmployee) return false;
  if (String(row.codigo ?? row.CODIGO) !== String(affectedEmployee.codigo)) return false;
  if (!affectedEmployee.ubicacion) return true;
  return String(row.ubicacion ?? row.UBICACION) === String(affectedEmployee.ubicacion);
}

function incrementalAuditResult(result, affectedEmployee) {
  const previousAudits = result.audit?.employeeAudits;
  if (!previousAudits?.length || !affectedEmployee) return auditResult(result);

  const affectedSummaries = (result.summaryByEmployee ?? []).filter((employee) =>
    matchesAffectedEmployee(employee, affectedEmployee),
  );
  if (!affectedSummaries.length) return auditResult(result);

  const affectedRows = (result.processedRows ?? []).filter((row) =>
    matchesAffectedEmployee(row, affectedEmployee),
  );
  const replacements = new Map(
    affectedSummaries.map((employee) => [
      employeeKey(employee),
      auditEmployee(
        employee,
        affectedRows.filter((row) => employeeKey(row) === employeeKey(employee)),
      ),
    ]),
  );
  const employeeAudits = previousAudits.map(
    (audit) => replacements.get(employeeKey(audit)) ?? audit,
  );
  const pendingEmployees = employeeAudits.filter((row) => row.requiereRevision);
  const general = buildGeneralAudit(employeeAudits);
  const eventuality = refreshEventualityReconciliation(result.eventualityAudit);
  const hasEventualityDifferences = Boolean(eventuality.enabled && eventuality.pendingItems.length);

  return {
    employeeAudits,
    pendingEmployees,
    general,
    eventuality,
    hasDiscrepancies:
      hasEventualityDifferences || pendingEmployees.length > 0 || general.diferenciaMin !== 0,
  };
}

export function recalculateAuditAndSummaries(result, options = {}) {
  const summaryByEmployee = result.summaryByEmployee ?? [];
  const summaryGeneral = aggregateRows(summaryByEmployee, { alcance: 'Total general' });
  const summaryByLocation = groupRows(summaryByEmployee, (row) => row.ubicacion)
    .map(([ubicacion, rows]) => aggregateRows(rows, { ubicacion, tipo: 'subtotal_ubicacion' }))
    .sort((a, b) => String(a.ubicacion).localeCompare(String(b.ubicacion), 'es'));
  const summaryBySchedule = groupRows(summaryByEmployee, (row) => row.tipoHorario)
    .map(([tipoHorario, rows]) => aggregateRows(rows, { tipoHorario }))
    .sort((a, b) => String(a.tipoHorario).localeCompare(String(b.tipoHorario), 'es'));
  const nextResult = {
    ...result,
    summaryGeneral,
    summaryByLocation,
    summaryBySchedule,
  };

  return {
    ...nextResult,
    audit: options.affectedEmployee
      ? incrementalAuditResult(nextResult, options.affectedEmployee)
      : auditResult(nextResult),
  };
}

function updateDuration(value, deltaMinutes) {
  return formatMinutes(parseDurationToMinutes(value) + deltaMinutes);
}

function subtractDuration(value, minutes) {
  return formatMinutes(Math.max(0, parseDurationToMinutes(value) - Math.max(0, minutes)));
}

function subtractHours(value, minutes) {
  return minutesToHours(Math.max(0, hoursToMinutes(value) - Math.max(0, minutes)));
}

function decrement(value, amount = 1) {
  return Math.max(0, cleanNumber(value) - amount);
}

function increment(value, amount = 1) {
  return cleanNumber(value) + amount;
}

function employeeMatchesItem(employee, item) {
  if (String(employee.codigo) !== String(item.codigo)) return false;
  if (!item.ubicacion) return true;
  return String(employee.ubicacion) === String(item.ubicacion);
}

function eventClassificationFields(type, bucket) {
  const justified = bucket === 'justified';
  if (type === 'tardanza') {
    return {
      count: justified ? 'tardanzasJustificadas' : 'tardanzasNoJustificadas',
      time: justified ? 'tiempoTardanzaJustificada' : 'tiempoTardanzaNoJustificada',
    };
  }
  if (type === 'salida_temprana') {
    return {
      count: justified ? 'salidasTempranasJustificadas' : 'salidasTempranasNoJustificadas',
      time: justified
        ? 'tiempoSalidaTempranaJustificada'
        : 'tiempoSalidaTempranaNoJustificada',
    };
  }
  if (type === 'ausencia') {
    return {
      count: justified ? 'ausenciasJustificadas' : 'ausenciasNoJustificadas',
      time: justified ? 'tiempoAusenciaJustificada' : 'tiempoAusenciaNoJustificada',
    };
  }
  return {};
}

function updateSpecificClassification(employee, type, bucket, minutes, direction) {
  if (!['justified', 'unjustified'].includes(bucket) || !minutes) return employee;
  const fields = eventClassificationFields(type, bucket);
  const next = { ...employee };

  if (fields.time) {
    next[fields.time] =
      direction > 0
        ? updateDuration(next[fields.time], minutes)
        : subtractDuration(next[fields.time], minutes);
  }
  if (fields.count) {
    next[fields.count] = direction > 0 ? increment(next[fields.count]) : decrement(next[fields.count]);
  }

  if (bucket === 'justified' && ['permiso', 'licencia', 'ausencia'].includes(type)) {
    next.tiempoEventualidadJustificada =
      direction > 0
        ? updateDuration(next.tiempoEventualidadJustificada, minutes)
        : subtractDuration(next.tiempoEventualidadJustificada, minutes);
    next.eventualidadesJustificadas =
      direction > 0
        ? increment(next.eventualidadesJustificadas)
        : decrement(next.eventualidadesJustificadas);
  }

  return next;
}

function markEventualityDecision(
  result,
  item,
  decision,
  minutes,
  note,
  appliedBucket,
  metadata = {},
) {
  const decisionLabels = {
    justified: 'Justificado',
    unjustified: 'No justificado',
    irregular: 'Ponchado irregular',
    discard: 'Descartado',
    confirm: 'Confirmado sin cambios',
  };
  const resolution = note || `${decisionLabels[decision] ?? decision}: ${formatMinutes(minutes)}`;
  const items = (result.eventualityAudit?.items ?? []).map((current) =>
    current.id === item.id
      ? {
          ...current,
          resolved: true,
          decision,
          appliedDecision:
            appliedBucket ??
            (decision === 'confirm'
              ? current.appliedDecision ?? current.clasificacionActual ?? 'none'
              : decision),
          appliedMinutes: minutes,
          clasificacionActual:
            appliedBucket ??
            (decision === 'confirm'
              ? current.appliedDecision ?? current.clasificacionActual ?? 'none'
              : decision === 'discard'
                ? 'none'
                : decision),
          tiempoClasificadoActualMin: decision === 'discard' ? 0 : minutes,
          resolution,
          resolvedAt: new Date().toISOString(),
          automatic: Boolean(metadata.automatic),
        }
      : current,
  );
  const processedRows = metadata.skipProcessedRows
    ? result.processedRows ?? []
    : (result.processedRows ?? []).map((row) => {
        const matchesRow =
          (item.filaAsistencia && String(row['#']) === String(item.filaAsistencia)) ||
          (String(row.CODIGO) === String(item.codigo) && String(row.FECHA) === String(item.fecha));
        if (!matchesRow) return row;
        return {
          ...row,
          'Decisión auditoría eventualidad': decisionLabels[decision] ?? decision,
          'Tiempo decidido en auditoría': formatMinutes(minutes),
          'Estado eventualidad externa': item.estadoEventualidadOriginal,
          'Comentario eventualidad externa': item.comentario,
          'Estado final': [row['Estado final'], `Auditoría: ${resolution}`]
            .filter(Boolean)
            .join('; '),
        };
      });

  return {
    ...result,
    processedRows,
    eventualityAudit: refreshEventualityReconciliation({
      ...result.eventualityAudit,
      items,
    }),
  };
}

export function applyAuditAdjustment(result, employeeAudit, bucket, options = {}) {
  const difference = Number(options.differenceMin ?? employeeAudit?.diferenciaMin ?? 0);
  if (!difference || !employeeAudit?.codigo) return result;
  const requestedMinutes =
    options.adjustmentMinutes == null
      ? Math.abs(difference)
      : Math.abs(Math.round(Number(options.adjustmentMinutes || 0)));
  if (!requestedMinutes) return result;

  const summaryByEmployee = (result.summaryByEmployee ?? []).map((employee) => {
    if (
      String(employee.codigo) !== String(employeeAudit.codigo) ||
      String(employee.ubicacion) !== String(employeeAudit.ubicacion)
    ) {
      return employee;
    }

    const field =
      bucket === 'justified'
        ? 'tiempoNoTrabajadoJustificado'
        : 'tiempoNoTrabajadoNoJustificado';
    const currentMinutes = parseDurationToMinutes(employee[field]);
    const delta = difference > 0 ? requestedMinutes : -Math.min(requestedMinutes, currentMinutes);
    const scopeLabel = options.scopeLabel ? ` (${options.scopeLabel})` : '';
    const adjustmentLabel =
      difference > 0
        ? `Ajuste de cuadre${scopeLabel}: +${formatMinutes(Math.abs(delta))} en ${
            bucket === 'justified' ? 'tiempo justificado' : 'tiempo no justificado'
          }`
        : `Ajuste de cuadre${scopeLabel}: -${formatMinutes(Math.abs(delta))} en ${
            bucket === 'justified' ? 'tiempo justificado' : 'tiempo no justificado'
          }`;

    return {
      ...employee,
      [field]: updateDuration(employee[field], delta),
      observacionProcesada: [employee.observacionProcesada, adjustmentLabel].filter(Boolean).join('; '),
      estadoFinal: [employee.estadoFinal, 'Cuadre revisado manualmente'].filter(Boolean).join('; '),
      ajusteCuadre: [employee.ajusteCuadre, adjustmentLabel].filter(Boolean).join('; '),
    };
  });

  return recalculateAuditAndSummaries({
    ...result,
    summaryByEmployee,
  }, { affectedEmployee: employeeAudit });
}

export function applyManualIrregularPunch(result, employeeAudit, detail = {}) {
  if (!employeeAudit?.codigo) return result;

  const expectedMin = Math.max(0, parseDurationToMinutes(detail.horasEsperadas));
  const recognizedMin = Math.max(0, parseDurationToMinutes(detail.horasReconocidas));
  const justifiedMin = Math.max(0, parseDurationToMinutes(detail.tiempoJustificado));
  const unjustifiedMin = Math.max(0, parseDurationToMinutes(detail.tiempoNoJustificado));
  const state = String(detail.estadoFinal || '');
  const scopeLabel = `fila ${detail.fila || '-'} ${detail.fecha || ''}`.trim();
  const adjustmentLabel = `Ponche irregular agregado manualmente (${scopeLabel})`;

  const summaryByEmployee = (result.summaryByEmployee ?? []).map((employee) => {
    if (
      String(employee.codigo) !== String(employeeAudit.codigo) ||
      String(employee.ubicacion) !== String(employeeAudit.ubicacion)
    ) {
      return employee;
    }

    const nextEmployee = {
      ...employee,
      ponchesIrregulares: cleanNumber(employee.ponchesIrregulares) + 1,
      diasATrabajar: decrement(employee.diasATrabajar),
      diasTrabajadosCompletos: decrement(employee.diasTrabajadosCompletos),
      horasEsperadas: subtractHours(employee.horasEsperadas, expectedMin),
      horasReconocidas: subtractHours(employee.horasReconocidas ?? employee.horasTrabajadasReconocidas, recognizedMin),
      horasTrabajadasReconocidas: subtractHours(employee.horasTrabajadasReconocidas ?? employee.horasReconocidas, recognizedMin),
      tiempoNoTrabajadoJustificado: subtractDuration(employee.tiempoNoTrabajadoJustificado, justifiedMin),
      tiempoNoTrabajadoNoJustificado: subtractDuration(employee.tiempoNoTrabajadoNoJustificado, unjustifiedMin),
      observacionProcesada: [employee.observacionProcesada, adjustmentLabel].filter(Boolean).join('; '),
      estadoFinal: [employee.estadoFinal, 'Ponche irregular agregado manualmente'].filter(Boolean).join('; '),
      ajusteCuadre: [employee.ajusteCuadre, adjustmentLabel].filter(Boolean).join('; '),
    };

    if (/tardanza/i.test(state) && unjustifiedMin > 0) {
      nextEmployee.tardanzasNoJustificadas = decrement(nextEmployee.tardanzasNoJustificadas);
      nextEmployee.tiempoTardanza = subtractDuration(nextEmployee.tiempoTardanza, unjustifiedMin);
      nextEmployee.tiempoTardanzaNoJustificada = subtractDuration(
        nextEmployee.tiempoTardanzaNoJustificada,
        unjustifiedMin,
      );
    }

    if (/tardanza/i.test(state) && justifiedMin > 0) {
      nextEmployee.tardanzasJustificadas = decrement(nextEmployee.tardanzasJustificadas);
      nextEmployee.tiempoTardanza = subtractDuration(nextEmployee.tiempoTardanza, justifiedMin);
      nextEmployee.tiempoTardanzaJustificada = subtractDuration(
        nextEmployee.tiempoTardanzaJustificada,
        justifiedMin,
      );
    }

    if (/salida temprana/i.test(state) && unjustifiedMin > 0) {
      nextEmployee.salidasTempranasNoJustificadas = decrement(nextEmployee.salidasTempranasNoJustificadas);
      nextEmployee.tiempoSalidaTemprana = subtractDuration(nextEmployee.tiempoSalidaTemprana, unjustifiedMin);
      nextEmployee.tiempoSalidaTempranaNoJustificada = subtractDuration(
        nextEmployee.tiempoSalidaTempranaNoJustificada,
        unjustifiedMin,
      );
    }

    if (/salida temprana/i.test(state) && justifiedMin > 0) {
      nextEmployee.salidasTempranasJustificadas = decrement(nextEmployee.salidasTempranasJustificadas);
      nextEmployee.tiempoSalidaTemprana = subtractDuration(nextEmployee.tiempoSalidaTemprana, justifiedMin);
      nextEmployee.tiempoSalidaTempranaJustificada = subtractDuration(
        nextEmployee.tiempoSalidaTempranaJustificada,
        justifiedMin,
      );
    }

    if (/ausencia/i.test(state) && unjustifiedMin > 0) {
      nextEmployee.ausenciasNoJustificadas = decrement(nextEmployee.ausenciasNoJustificadas);
      nextEmployee.tiempoAusenciaNoJustificada = subtractDuration(
        nextEmployee.tiempoAusenciaNoJustificada,
        unjustifiedMin,
      );
    }

    if (/ausencia/i.test(state) && justifiedMin > 0) {
      nextEmployee.ausenciasJustificadas = decrement(nextEmployee.ausenciasJustificadas, justifiedMin > 0 ? 1 : 0);
      nextEmployee.tiempoAusenciaJustificada = subtractDuration(
        nextEmployee.tiempoAusenciaJustificada,
        justifiedMin,
      );
    }

    if (/permiso/i.test(state)) {
      nextEmployee.permisos = decrement(nextEmployee.permisos, justifiedMin > 0 ? 1 : 0);
    }

    if (/licencia/i.test(state)) {
      nextEmployee.licencias = decrement(nextEmployee.licencias, justifiedMin > 0 ? 1 : 0);
    }

    if (justifiedMin > 0) {
      nextEmployee.tiempoEventualidadJustificada = subtractDuration(
        nextEmployee.tiempoEventualidadJustificada,
        justifiedMin,
      );
    }

    return nextEmployee;
  });

  const poncheRow = {
    NOMBRE: employeeAudit.nombre,
    CODIGO: employeeAudit.codigo,
    UBICACION: employeeAudit.ubicacion,
    FECHA: detail.fecha,
    DIA: detail.dia,
    'Hora entrada': detail.entrada,
    'Hora salida': detail.salida,
    'Observación original': detail.observacion,
    'Observación procesada': adjustmentLabel,
    'Estado final': 'Ponche irregular agregado manualmente',
  };

  return recalculateAuditAndSummaries({
    ...result,
    summaryByEmployee,
    events: {
      ...(result.events ?? {}),
      ponchesIrregulares: [...(result.events?.ponchesIrregulares ?? []), poncheRow],
    },
  }, { affectedEmployee: employeeAudit });
}

export function resolveEventualityAuditItem(result, itemId, resolution = 'Revisado por el usuario') {
  if (!result?.eventualityAudit?.enabled || !itemId) return result;

  const items = (result.eventualityAudit.items ?? []).map((item) =>
    item.id === itemId
      ? {
          ...item,
          resolved: true,
          resolution,
          resolvedAt: new Date().toISOString(),
        }
      : item,
  );

  return recalculateAuditAndSummaries({
    ...result,
    eventualityAudit: refreshEventualityReconciliation({
      ...result.eventualityAudit,
      items,
    }),
  });
}

function applyEventualityAuditDecisionCore(result, item, decision, options = {}) {
  if (!result?.eventualityAudit?.enabled || !item?.id) return result;

  const minutes = Math.max(
    0,
    Math.round(
      Number(
        options.minutes ??
          item.appliedMinutes ??
          item.tiempoSugeridoMin ??
          item.horasEsperadasMin ??
          0,
      ),
    ),
  );

  if (decision === 'confirm') {
    return markEventualityDecision(
      result,
      item,
      decision,
      minutes,
      options.automatic ? 'Confirmado automÃ¡ticamente sin cambios' : 'Confirmado sin cambios',
      item.appliedDecision ?? item.clasificacionActual ?? 'none',
      options,
    );
  }

  const targetBucket = decision === 'discard' ? 'none' : decision;
  const currentBucket = item.appliedDecision ?? item.clasificacionActual ?? 'none';
  const currentMinutes = Math.max(
    0,
    Math.round(Number(item.appliedMinutes ?? item.tiempoClasificadoActualMin ?? minutes)),
  );
  const eventType = item.tipoExterno || item.tiposAsistencia?.[0] || '';

  const summaryByEmployee = (result.summaryByEmployee ?? []).map((employee) => {
    if (!employeeMatchesItem(employee, item)) return employee;
    let next = { ...employee };

    if (['justified', 'unjustified'].includes(currentBucket) && currentMinutes > 0) {
      const sourceField =
        currentBucket === 'justified'
          ? 'tiempoNoTrabajadoJustificado'
          : 'tiempoNoTrabajadoNoJustificado';
      const removable = Math.min(currentMinutes, parseDurationToMinutes(next[sourceField]));
      next[sourceField] = subtractDuration(next[sourceField], removable);
      next = updateSpecificClassification(next, eventType, currentBucket, removable, -1);
    }

    if (['justified', 'unjustified'].includes(targetBucket) && minutes > 0) {
      const targetField =
        targetBucket === 'justified'
          ? 'tiempoNoTrabajadoJustificado'
          : 'tiempoNoTrabajadoNoJustificado';
      next[targetField] = updateDuration(next[targetField], minutes);
      next = updateSpecificClassification(next, eventType, targetBucket, minutes, 1);
    }

    const label =
      targetBucket === 'none'
        ? `Eventualidad descartada en auditoría (${item.fecha})`
        : `Eventualidad reclasificada como ${targetBucket === 'justified' ? 'justificada' : 'no justificada'} (${item.fecha}, ${formatMinutes(minutes)})`;
    next.observacionProcesada = [next.observacionProcesada, label].filter(Boolean).join('; ');
    next.estadoFinal = [next.estadoFinal, label].filter(Boolean).join('; ');
    next.ajusteCuadre = [next.ajusteCuadre, label].filter(Boolean).join('; ');
    return next;
  });

  return markEventualityDecision(
    {
      ...result,
      summaryByEmployee,
    },
    item,
    decision,
    minutes,
    options.automatic
      ? `Clasificado automÃ¡ticamente como ${targetBucket === 'justified' ? 'justificado' : 'no justificado'}`
      : undefined,
    targetBucket,
    options,
  );
}

export function applyEventualityAuditDecision(result, item, decision, options = {}) {
  if (!result?.eventualityAudit?.enabled || !item?.id) return result;

  if (decision === 'irregular') {
    const irregularResult = applyManualIrregularPunch(
      result,
      {
        codigo: item.codigo,
        nombre: item.nombre,
        ubicacion: item.ubicacion,
      },
      {
        fila: item.filaAsistencia,
        fecha: item.fecha,
        dia: item.dia,
        entrada: item.entrada,
        salida: item.salida,
        observacion: item.observacionAsistencia || item.comentario,
        horasEsperadas: formatMinutes(item.horasEsperadasMin),
        horasReconocidas: formatMinutes(item.horasReconocidasMin),
        tiempoJustificado: formatMinutes(item.tiempoJustificadoMin),
        tiempoNoJustificado: formatMinutes(item.tiempoNoJustificadoMin),
        estadoFinal: item.estadoAsistencia,
      },
    );
    return recalculateAuditAndSummaries(
      markEventualityDecision(
        irregularResult,
        item,
        decision,
        Math.max(0, Math.round(Number(options.minutes ?? item.tiempoSugeridoMin ?? 0))),
        'Reclasificado como ponchado irregular',
        'irregular',
      ),
      { affectedEmployee: item },
    );
  }

  return recalculateAuditAndSummaries(
    applyEventualityAuditDecisionCore(result, item, decision, options),
    { affectedEmployee: item },
  );
}

const AUTOMATIC_EVENT_TYPES = new Set([
  'permiso',
  'licencia',
  'ausencia',
  'tardanza',
  'salida_temprana',
]);

export function applyAutomaticEventualityDecisions(result) {
  const items = result?.eventualityAudit?.items ?? [];
  const eligible = items.filter(
    (item) =>
      !item.resolved &&
      item.status === 'confirmado' &&
      !item.pendingTime &&
      item.sourceMatch &&
      item.tipoExterno &&
      Number(item.tiempoSugeridoMin || 0) > 0,
  );
  if (!eligible.length) return recalculateAuditAndSummaries(result);

  let nextResult = result;
  let automaticCount = 0;
  eligible.forEach((originalItem) => {
    const item = nextResult.eventualityAudit.items.find((current) => current.id === originalItem.id);
    if (!item) return;
    const canReclassify = AUTOMATIC_EVENT_TYPES.has(item.tipoExterno);
    const decision = canReclassify && ['justified', 'unjustified'].includes(item.recomendacion)
      ? item.recomendacion
      : 'confirm';
    if (decision === 'confirm' && canReclassify && !item.recomendacion) return;
    nextResult = applyEventualityAuditDecisionCore(nextResult, item, decision, {
      minutes: item.tiempoSugeridoMin,
      automatic: true,
      skipProcessedRows: true,
    });
    automaticCount += 1;
  });

  if (!automaticCount) return recalculateAuditAndSummaries(result);
  const automaticItems = nextResult.eventualityAudit.items.filter((item) => item.automatic);
  const automaticByRow = new Map();
  automaticItems.forEach((item) => {
    const key = item.filaAsistencia
      ? `fila:${item.filaAsistencia}`
      : `empleado:${item.codigo}:${item.fecha}`;
    if (!automaticByRow.has(key)) automaticByRow.set(key, []);
    automaticByRow.get(key).push(item);
  });
  const processedRows = (nextResult.processedRows ?? []).map((row) => {
    const byRow = automaticByRow.get(`fila:${row['#']}`) ?? [];
    const matches = byRow.length
      ? byRow
      : automaticByRow.get(`empleado:${row.CODIGO}:${row.FECHA}`) ?? [];
    if (!matches.length) return row;
    return {
      ...row,
      'DecisiÃ³n auditorÃ­a eventualidad': matches
        .map((item) => item.decision === 'justified' ? 'Justificado' : item.decision === 'unjustified' ? 'No justificado' : 'Confirmado sin cambios')
        .join('; '),
      'Tiempo decidido en auditorÃ­a': matches.map((item) => formatMinutes(item.appliedMinutes)).join('; '),
      'Estado final': [
        row['Estado final'],
        ...matches.map((item) => `AuditorÃ­a automÃ¡tica: ${item.resolution}`),
      ].filter(Boolean).join('; '),
    };
  });
  const refreshed = refreshEventualityReconciliation(nextResult.eventualityAudit);
  refreshed.stats = {
    ...refreshed.stats,
    automaticProcessed: automaticCount,
  };
  return recalculateAuditAndSummaries({
    ...nextResult,
    processedRows,
    eventualityAudit: refreshed,
  });
}
