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

export function auditEmployee(employee) {
  const expectedMin = hoursToMinutes(employee.horasEsperadas);
  const recognizedMin = hoursToMinutes(
    employee.horasReconocidas ?? employee.horasTrabajadasReconocidas,
  );
  const justifiedMin = parseDurationToMinutes(employee.tiempoNoTrabajadoJustificado);
  const unjustifiedMin = parseDurationToMinutes(employee.tiempoNoTrabajadoNoJustificado);
  const explainedMin = recognizedMin + justifiedMin + unjustifiedMin;
  const differenceMin = expectedMin - explainedMin;
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
    posibleCausa:
      differenceMin > 0
        ? 'Falta clasificar tiempo no trabajado.'
        : differenceMin < 0
          ? 'El tiempo explicado supera las horas esperadas.'
          : 'Sin descuadre.',
  };
}

export function auditResult(result) {
  const employees = result?.summaryByEmployee ?? [];
  const employeeAudits = employees.map(auditEmployee);
  const pendingEmployees = employeeAudits.filter((row) => row.requiereRevision);
  const general = buildGeneralAudit(employeeAudits);

  return {
    employeeAudits,
    pendingEmployees,
    general,
    hasDiscrepancies: pendingEmployees.length > 0 || general.diferenciaMin !== 0,
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

export function recalculateAuditAndSummaries(result) {
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
    audit: auditResult(nextResult),
  };
}

function updateDuration(value, deltaMinutes) {
  return formatMinutes(parseDurationToMinutes(value) + deltaMinutes);
}

export function applyAuditAdjustment(result, employeeAudit, bucket) {
  const difference = Number(employeeAudit?.diferenciaMin || 0);
  if (!difference || !employeeAudit?.codigo) return result;

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
    const delta = difference > 0 ? difference : -Math.min(Math.abs(difference), currentMinutes);
    const adjustmentLabel =
      difference > 0
        ? `Ajuste de cuadre: +${formatMinutes(Math.abs(delta))} en ${
            bucket === 'justified' ? 'tiempo justificado' : 'tiempo no justificado'
          }`
        : `Ajuste de cuadre: -${formatMinutes(Math.abs(delta))} en ${
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
  });
}
