import * as XLSX from 'xlsx';
import { getEmployeeCodeKeys } from './extendedScheduleReader.js';
import { parseDateValue, parseDurationToMinutes } from './timeUtils.js';

const HEADER_ALIASES = {
  code: ['CODIGO', 'CODIGO EMPLEADO', 'CODIGO DE EMPLEADO', 'COD EMPLEADO', 'ID EMPLEADO'],
  name: ['NOMBRE', 'NOMBRE COMPLETO', 'NOMBRES Y APELLIDOS', 'NOMBRES Y APELLIDOS DEL EMPLEADO'],
  type: ['TIPO DE EVENTUALIDAD', 'TIPO EVENTUALIDAD', 'EVENTUALIDAD', 'TIPO'],
  location: ['UBICACION', 'DEPARTAMENTO', 'AREA', 'DIRECCION'],
  startDate: ['FECHA INICIO', 'FECHA DE INICIO', 'DESDE', 'FECHA'],
  endDate: ['FECHA FIN', 'FECHA DE FIN', 'HASTA'],
  days: ['CANTIDAD DIAS', 'CANTIDAD DE DIAS', 'DIAS', 'NO. DIAS'],
  hours: ['CANTIDAD HORAS', 'CANTIDAD DE HORAS', 'HORAS', 'NO. HORAS'],
  status: [
    'ESTADO DE LA EVENTUALIDAD',
    'ESTADO EVENTUALIDAD',
    'ESTADO',
    'ESTATUS',
    'APROBACION',
    'APROBADO',
  ],
  comment: ['COMENTARIO', 'COMENTARIOS', 'OBSERVACION', 'OBSERVACIONES', 'NOTA', 'DETALLE'],
};

export const EVENTUALITY_TYPES = {
  VACATION: 'vacacion',
  LICENSE: 'licencia',
  PERMIT: 'permiso',
  ABSENCE: 'ausencia',
  TARDINESS: 'tardanza',
  EARLY_EXIT: 'salida_temprana',
  TRAVEL: 'ver_viatico',
  HOLIDAY: 'feriado',
  IRREGULAR_PUNCH: 'ponche_irregular',
};

const TYPE_LABELS = {
  [EVENTUALITY_TYPES.VACATION]: 'Vacaciones',
  [EVENTUALITY_TYPES.LICENSE]: 'Licencia',
  [EVENTUALITY_TYPES.PERMIT]: 'Permiso',
  [EVENTUALITY_TYPES.ABSENCE]: 'Ausencia',
  [EVENTUALITY_TYPES.TARDINESS]: 'Tardanza',
  [EVENTUALITY_TYPES.EARLY_EXIT]: 'Salida temprana',
  [EVENTUALITY_TYPES.TRAVEL]: 'Ver viatico',
  [EVENTUALITY_TYPES.HOLIDAY]: 'Feriado',
  [EVENTUALITY_TYPES.IRREGULAR_PUNCH]: 'Ponche irregular',
};

function normalizeText(value = '') {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function clean(value) {
  return String(value ?? '').trim();
}

function isInformationalEventuality(value = '') {
  const normalized = normalizeText(value).replace(/#/g, ' ').replace(/\s+/g, ' ').trim();
  return /\bD.AS?\s+PENDIENTES?\b/.test(normalized) || /\bSALDO\b/.test(normalized);
}

function findHeader(headers, aliases) {
  const normalizedAliases = aliases.map(normalizeText);
  return (
    headers.find((header) => normalizedAliases.includes(normalizeText(header))) ??
    headers.find((header) =>
      normalizedAliases.some((alias) => normalizeText(header).includes(alias)),
    ) ??
    null
  );
}

function inferMapping(rows = []) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return Object.fromEntries(
    Object.entries(HEADER_ALIASES).map(([field, aliases]) => [field, findHeader(headers, aliases)]),
  );
}

function scoreSheet(rows = []) {
  const mapping = inferMapping(rows);
  return ['code', 'type', 'startDate', 'endDate', 'days', 'hours'].reduce(
    (score, field) => score + (mapping[field] ? 1 : 0),
    0,
  );
}

export function normalizeEventualityType(value = '') {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  if (/VACACION/.test(normalized)) return EVENTUALITY_TYPES.VACATION;
  if (/LICENCIA/.test(normalized)) return EVENTUALITY_TYPES.LICENSE;
  if (/PERMISO/.test(normalized)) return EVENTUALITY_TYPES.PERMIT;
  if (/AUSENCIA|INASISTENCIA/.test(normalized)) return EVENTUALITY_TYPES.ABSENCE;
  if (/TARDAN/.test(normalized)) return EVENTUALITY_TYPES.TARDINESS;
  if (/SALIDA.*(TEMPRANA|ANTICIPADA)|SALIDA TEMPRANA/.test(normalized)) {
    return EVENTUALITY_TYPES.EARLY_EXIT;
  }
  if (/VIATICO|TRABAJO EXTERNO/.test(normalized)) return EVENTUALITY_TYPES.TRAVEL;
  if (/FERIADO/.test(normalized)) return EVENTUALITY_TYPES.HOLIDAY;
  if (/PONCH.*IRREGULAR|PONCHE INCOMPLETO/.test(normalized)) {
    return EVENTUALITY_TYPES.IRREGULAR_PUNCH;
  }
  return '';
}

export function eventualityTypeLabel(type) {
  return TYPE_LABELS[type] ?? 'Tipo no reconocido';
}

export function normalizeEventualityStatus(value = '') {
  const normalized = normalizeText(value);
  if (!normalized) return { key: 'sin_estado', label: 'Sin estado', recommendation: '' };
  if (/NO\s+JUSTIFIC|INJUSTIFIC|RECHAZ|NO\s+APROBAD|DENEGAD/.test(normalized)) {
    return { key: 'no_justificado', label: clean(value), recommendation: 'unjustified' };
  }
  if (/JUSTIFIC|APROBAD|AUTORIZAD|ACEPTAD/.test(normalized)) {
    return { key: 'justificado', label: clean(value), recommendation: 'justified' };
  }
  if (/PENDIENT|EN\s+PROCESO|REVISION/.test(normalized)) {
    return { key: 'pendiente', label: clean(value), recommendation: '' };
  }
  return { key: 'otro', label: clean(value), recommendation: '' };
}

function formatDateKey(value) {
  const date = value instanceof Date ? value : parseDateValue(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseQuantity(value) {
  const raw = clean(value).replace(',', '.');
  if (!raw) return null;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
}

function datesInRange(startDate, endDate) {
  const start = parseDateValue(startDate);
  const end = parseDateValue(endDate) ?? start;
  if (!start || !end) return [];

  const from = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const to = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  if (to < from) return [];

  const dates = [];
  const cursor = new Date(from);
  while (cursor <= to && dates.length < 370) {
    dates.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function belongsToMonth(dateKey, evaluationMonth) {
  if (!evaluationMonth || !dateKey) return true;
  const [year, month] = dateKey.split('-').map(Number);
  return year === Number(evaluationMonth.year) && month - 1 === Number(evaluationMonth.month);
}

function parseSheetRows(workbook, sheetName) {
  const worksheet = workbook.Sheets[sheetName];
  return worksheet ? XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false }) : [];
}

export function eventualityIndexKey(code, date) {
  const codeKey = getEmployeeCodeKeys(code)[0] ?? '';
  return codeKey && date ? `${codeKey}::${date}` : '';
}

export function buildEventualitiesIndex(records = []) {
  return records.reduce((index, record) => {
    getEmployeeCodeKeys(record.codigo).forEach((code) => {
      const key = `${code}::${record.fecha}`;
      if (!index[key]) index[key] = [];
      index[key].push(record);
    });
    return index;
  }, {});
}

export function findEventualitiesForRow(index = {}, code, date) {
  const normalizedDate = formatDateKey(date);
  const matches = [];
  getEmployeeCodeKeys(code).forEach((codeKey) => {
    (index[`${codeKey}::${normalizedDate}`] ?? []).forEach((record) => matches.push(record));
  });
  return Array.from(new Map(matches.map((record) => [record.id, record])).values());
}

export function parseEventualitiesWorkbook(arrayBuffer, fileName, evaluationMonth) {
  if (!arrayBuffer) {
    return {
      enabled: false,
      fileName: '',
      sheets: [],
      records: [],
      recordsByCodeDate: {},
      warnings: [],
      stats: {
        sourceRows: 0,
        dailyRecords: 0,
        unknownTypes: 0,
        pendingTime: 0,
        ignoredInformationalRows: 0,
      },
    };
  }

  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true, raw: false });
  const records = [];
  const warnings = [];
  const sheets = [];
  let sourceRows = 0;
  let unknownTypes = 0;
  let ignoredInformationalRows = 0;

  workbook.SheetNames.forEach((sheetName) => {
    const rows = parseSheetRows(workbook, sheetName);
    const mapping = inferMapping(rows);
    const score = scoreSheet(rows);
    if (score < 3) return;

    sheets.push({ sheetName, rowCount: rows.length, mapping });
    sourceRows += rows.length;

    rows.forEach((row, rowIndex) => {
      const codigo = clean(row?.[mapping.code]);
      const rawType = clean(row?.[mapping.type]);
      const tipo = normalizeEventualityType(rawType);
      const fechas = datesInRange(row?.[mapping.startDate], row?.[mapping.endDate]);
      const cantidadDias = parseQuantity(row?.[mapping.days]);
      const cantidadHoras = parseQuantity(row?.[mapping.hours]);
      const rawStatus = clean(row?.[mapping.status]);
      const status = normalizeEventualityStatus(rawStatus);
      const comment = clean(row?.[mapping.comment]);

      if (!codigo || !fechas.length || !rawType) return;
      if (isInformationalEventuality(rawType)) {
        ignoredInformationalRows += 1;
        return;
      }
      if (!tipo) unknownTypes += 1;

      const positiveHours = cantidadHoras > 0 ? cantidadHoras : 0;
      const positiveDays = cantidadDias > 0 ? cantidadDias : 0;
      const pendingTime = cantidadDias === -1 || cantidadHoras === -1;

      fechas.filter((fecha) => belongsToMonth(fecha, evaluationMonth)).forEach((fecha, dayIndex) => {
        records.push({
          id: `${sheetName}-${rowIndex + 2}-${dayIndex}-${codigo}-${fecha}-${tipo || 'desconocido'}`,
          sourceRow: rowIndex + 2,
          sheetName,
          codigo,
          nombre: clean(row?.[mapping.name]),
          ubicacion: clean(row?.[mapping.location]),
          tipo,
          tipoOriginal: rawType,
          tipoLabel: eventualityTypeLabel(tipo),
          fecha,
          fechaInicio: formatDateKey(row?.[mapping.startDate]),
          fechaFin: formatDateKey(row?.[mapping.endDate] ?? row?.[mapping.startDate]),
          cantidadDias,
          cantidadHoras,
          exactMinutes: positiveHours ? Math.round(positiveHours * 60) : null,
          fullDayCount: positiveDays || null,
          pendingTime,
          estado: status.key,
          estadoOriginal: status.label,
          recomendacion: status.recommendation,
          comentario: comment,
          source: 'Excel de eventualidades',
        });
      });
    });
  });

  if (!sheets.length) {
    warnings.push(
      `${fileName}: no se encontro una hoja con CODIGO, TIPO DE EVENTUALIDAD y FECHA INICIO.`,
    );
  }
  if (unknownTypes) {
    warnings.push(
      `${fileName}: ${unknownTypes} registro(s) tienen un tipo de eventualidad no reconocido.`,
    );
  }
  if (ignoredInformationalRows) {
    warnings.push(
      `${fileName}: ${ignoredInformationalRows} fila(s) de dias pendientes o saldo fueron ignoradas.`,
    );
  }

  return {
    enabled: true,
    fileName,
    sheets,
    records,
    recordsByCodeDate: buildEventualitiesIndex(records),
    warnings,
    stats: {
      sourceRows,
      dailyRecords: records.length,
      unknownTypes,
      pendingTime: records.filter((record) => record.pendingTime).length,
      ignoredInformationalRows,
    },
  };
}

function splitDetectedTypes(value) {
  return String(value ?? '')
    .split(';')
    .map((type) => type.trim())
    .filter(Boolean);
}

function reconciliationPriority(status) {
  return {
    tipo_no_reconocido: 0,
    tipo_diferente: 1,
    solo_eventualidades: 2,
    solo_asistencia: 3,
    requiere_confirmacion: 4,
    confirmado: 9,
  }[status] ?? 8;
}

function buildReconciliationItem({
  id,
  status,
  code,
  name,
  location,
  date,
  externalRecord,
  attendanceTypes = [],
  sourceRow,
  attendance,
}) {
  const statusMessages = {
    tipo_no_reconocido: 'El tipo del Excel de eventualidades no fue reconocido.',
    tipo_diferente: 'El codigo y la fecha coinciden, pero el tipo de eventualidad es diferente.',
    solo_eventualidades: 'La eventualidad aparece en el Excel de eventualidades, pero no en asistencia.',
    solo_asistencia: 'La eventualidad aparece en asistencia, pero no en el Excel de eventualidades.',
    requiere_confirmacion: 'La eventualidad coincide, pero el tiempo contiene -1 y debe confirmarse.',
    confirmado: 'La eventualidad coincide por codigo, fecha y tipo.',
  };

  const externalSuggestedMinutes =
    externalRecord?.exactMinutes ?? (externalRecord?.fullDayCount ? 8 * 60 : null);
  const eventType = externalRecord?.tipo || attendanceTypes[0] || '';
  const eventTime = attendance?.eventTimes?.[eventType] ?? {};
  const attendanceSuggestedMinutes =
    eventTime.justifiedMinutes ||
    eventTime.unjustifiedMinutes ||
    (eventType === EVENTUALITY_TYPES.ABSENCE ? attendance?.expectedMinutes : 0) ||
    0;
  const suggestedMinutes = externalSuggestedMinutes ?? attendanceSuggestedMinutes;
  const currentBucket = /ponche irregular|ponche incompleto/i.test(attendance?.finalState ?? '')
    ? 'irregular'
    : eventTime.justifiedMinutes > 0
      ? 'justified'
      : eventTime.unjustifiedMinutes > 0
        ? 'unjustified'
        : 'none';

  return {
    id,
    status,
    priority: reconciliationPriority(status),
    resolved: false,
    sourceMatch: status === 'confirmado',
    codigo: code,
    nombre: name || externalRecord?.nombre || '',
    ubicacion: location || externalRecord?.ubicacion || '',
    fecha: date,
    tipoExterno: externalRecord?.tipo ?? '',
    tipoExternoLabel:
      externalRecord?.tipoLabel || externalRecord?.tipoOriginal || 'No registrado',
    tiposAsistencia: attendanceTypes,
    tiposAsistenciaLabel: attendanceTypes.length
      ? attendanceTypes.map(eventualityTypeLabel).join(', ')
      : 'Ninguna',
    cantidadDias: externalRecord?.cantidadDias ?? null,
    cantidadHoras: externalRecord?.cantidadHoras ?? null,
    pendingTime: Boolean(externalRecord?.pendingTime),
    tiempoExactoMin: externalRecord?.exactMinutes ?? null,
    tiempoSugeridoMin: suggestedMinutes,
    clasificacionActual: currentBucket,
    tiempoClasificadoActualMin:
      currentBucket === 'justified'
        ? eventTime.justifiedMinutes ?? 0
        : currentBucket === 'unjustified'
          ? eventTime.unjustifiedMinutes ?? 0
          : 0,
    estadoEventualidad: externalRecord?.estado ?? 'sin_estado',
    estadoEventualidadOriginal: externalRecord?.estadoOriginal ?? 'Sin estado',
    recomendacion: externalRecord?.recomendacion ?? '',
    comentario: externalRecord?.comentario ?? '',
    fechaInicio: externalRecord?.fechaInicio ?? date,
    fechaFin: externalRecord?.fechaFin ?? date,
    hoja: externalRecord?.sheetName ?? '',
    filaEventualidades: externalRecord?.sourceRow ?? '',
    filaAsistencia: sourceRow ?? '',
    dia: attendance?.day ?? '',
    entrada: attendance?.entry ?? '',
    salida: attendance?.exit ?? '',
    observacionAsistencia: attendance?.observation ?? '',
    estadoAsistencia: attendance?.finalState ?? '',
    horasEsperadasMin: attendance?.expectedMinutes ?? 0,
    horasReconocidasMin: attendance?.recognizedMinutes ?? 0,
    tiempoJustificadoMin: attendance?.justifiedMinutes ?? 0,
    tiempoNoJustificadoMin: attendance?.unjustifiedMinutes ?? 0,
    reason: statusMessages[status] ?? 'Revisar coincidencia.',
  };
}

function isPendingExternalStatus(item = {}) {
  return ['pendiente', 'otro', 'sin_estado'].includes(item.estadoEventualidad);
}

function isClearAutomaticUnjustified(item = {}) {
  return (
    item.status === 'solo_asistencia' &&
    item.clasificacionActual === 'unjustified' &&
    Number(item.tiempoClasificadoActualMin || item.tiempoSugeridoMin || 0) > 0 &&
    !item.tipoExterno
  );
}

function needsManualReview(item = {}) {
  if (item.resolved) return false;
  if (item.pendingTime || item.status === 'requiere_confirmacion') return true;
  if (['tipo_no_reconocido', 'tipo_diferente'].includes(item.status)) return true;
  if (isClearAutomaticUnjustified(item)) return false;
  if (item.status === 'solo_eventualidades') return true;
  if (item.status === 'solo_asistencia') return item.clasificacionActual !== 'unjustified';
  if (item.status === 'confirmado') return isPendingExternalStatus(item);
  return false;
}

function buildReconciliationStats(items = [], previousStats = {}) {
  const pendingItems = items.filter(needsManualReview);
  return {
    ...(previousStats ?? {}),
    total: items.length,
    confirmed: items.filter((item) => item.status === 'confirmado' || item.resolved).length,
    sourceMatches: items.filter((item) => item.sourceMatch).length,
    pending: pendingItems.length,
    onlyEventualities: pendingItems.filter((item) => item.status === 'solo_eventualidades').length,
    onlyAttendance: pendingItems.filter((item) => item.status === 'solo_asistencia').length,
    differentType: pendingItems.filter((item) => item.status === 'tipo_diferente').length,
    pendingTime: pendingItems.filter((item) => item.pendingTime).length,
    automaticClear: items.filter((item) => !needsManualReview(item) && !item.resolved).length,
  };
}

export function buildEventualityReconciliation(eventualities, processedRows = []) {
  if (!eventualities?.enabled) {
    return {
      enabled: false,
      items: [],
      pendingItems: [],
      stats: { total: 0, confirmed: 0, pending: 0 },
    };
  }

  const attendanceByKey = new Map();
  processedRows.forEach((row) => {
    const date = formatDateKey(row.FECHA);
    const code = clean(row.CODIGO);
    const key = eventualityIndexKey(code, date);
    if (!key) return;
    attendanceByKey.set(key, {
      code,
      date,
      name: clean(row.NOMBRE),
      location: clean(row.UBICACION),
      sourceRow: row['#'],
      day: clean(row.DIA),
      entry: clean(row['Hora entrada']),
      exit: clean(row['Hora salida']),
      observation: clean(row['Observación original']),
      finalState: clean(row['Estado final']),
      expectedMinutes: Math.round(Number(row['Horas esperadas'] || 0) * 60),
      recognizedMinutes: Math.round(Number(row['Horas trabajadas reconocidas'] || 0) * 60),
      justifiedMinutes: parseDurationToMinutes(row['Tiempo no trabajado justificado']),
      unjustifiedMinutes: parseDurationToMinutes(row['Tiempo no trabajado no justificado']),
      eventTimes: {
        [EVENTUALITY_TYPES.TARDINESS]: {
          justifiedMinutes: parseDurationToMinutes(row['Tiempo tardanza justificada']),
          unjustifiedMinutes: parseDurationToMinutes(row['Tiempo tardanza no justificada']),
        },
        [EVENTUALITY_TYPES.EARLY_EXIT]: {
          justifiedMinutes: parseDurationToMinutes(row['Tiempo salida temprana justificada']),
          unjustifiedMinutes: parseDurationToMinutes(row['Tiempo salida temprana no justificada']),
        },
        [EVENTUALITY_TYPES.ABSENCE]: {
          justifiedMinutes: parseDurationToMinutes(row['Tiempo ausencia justificada']),
          unjustifiedMinutes: parseDurationToMinutes(row['Tiempo ausencia no justificada']),
        },
        [EVENTUALITY_TYPES.PERMIT]: {
          justifiedMinutes: /permiso/i.test(row['Estado final'] ?? '')
            ? parseDurationToMinutes(row['Tiempo no trabajado justificado'])
            : 0,
          unjustifiedMinutes: 0,
        },
        [EVENTUALITY_TYPES.LICENSE]: {
          justifiedMinutes: /licencia/i.test(row['Estado final'] ?? '')
            ? parseDurationToMinutes(row['Tiempo no trabajado justificado'])
            : 0,
          unjustifiedMinutes: 0,
        },
      },
      types: splitDetectedTypes(
        row['Tipos de eventualidad en asistencia'] || row['Tipos de eventualidad detectados'],
      ),
    });
  });

  const externalByKey = new Map();
  const auditableExternalRecords = eventualities.records.filter(
    (record) => record.tipo !== EVENTUALITY_TYPES.TRAVEL,
  );
  const ignoredTravelRecords = eventualities.records.length - auditableExternalRecords.length;
  auditableExternalRecords.forEach((record) => {
    const key = eventualityIndexKey(record.codigo, record.fecha);
    if (!key) return;
    if (!externalByKey.has(key)) externalByKey.set(key, []);
    externalByKey.get(key).push(record);
  });

  const items = [];
  const keys = new Set(attendanceByKey.keys());
  const ignoredExternalRecords = Array.from(externalByKey.entries()).reduce(
    (total, [key, records]) => total + (attendanceByKey.has(key) ? 0 : records.length),
    0,
  );

  keys.forEach((key) => {
    const attendance = attendanceByKey.get(key);
    const externalRecords = externalByKey.get(key) ?? [];
    const attendanceTypes = (attendance?.types ?? []).filter(
      (type) => type !== EVENTUALITY_TYPES.TRAVEL,
    );
    const externalTypes = new Set(externalRecords.map((record) => record.tipo).filter(Boolean));
    const hasAnyTypeMatch = attendanceTypes.some((type) => externalTypes.has(type));

    externalRecords.forEach((record) => {
      let status = 'confirmado';
      if (!record.tipo) status = 'tipo_no_reconocido';
      else if (!attendance) status = 'solo_eventualidades';
      else if (!attendanceTypes.includes(record.tipo)) {
        status = attendanceTypes.length ? 'tipo_diferente' : 'solo_eventualidades';
      } else if (record.pendingTime) status = 'requiere_confirmacion';

      items.push(
        buildReconciliationItem({
          id: `external::${record.id}`,
          status,
          code: attendance?.code || record.codigo,
          name: attendance?.name,
          location: attendance?.location,
          date: record.fecha,
          externalRecord: record,
          attendanceTypes,
          sourceRow: attendance?.sourceRow,
          attendance,
        }),
      );
    });

    attendanceTypes.forEach((type) => {
      if (externalTypes.has(type)) return;
      if (externalRecords.length && !hasAnyTypeMatch) return;
      items.push(
        buildReconciliationItem({
          id: `attendance::${key}::${type}`,
          status: externalRecords.length ? 'tipo_diferente' : 'solo_asistencia',
          code: attendance.code,
          name: attendance.name,
          location: attendance.location,
          date: attendance.date,
          externalRecord: externalRecords[0],
          attendanceTypes: [type],
          sourceRow: attendance.sourceRow,
          attendance,
        }),
      );
    });
  });

  items.sort(
    (a, b) =>
      a.priority - b.priority ||
      String(a.ubicacion).localeCompare(String(b.ubicacion), 'es') ||
      String(a.nombre).localeCompare(String(b.nombre), 'es') ||
      String(a.fecha).localeCompare(String(b.fecha)),
  );
  const pendingItems = items.filter(needsManualReview);

  return {
    enabled: true,
    items,
    pendingItems,
    stats: {
      ...buildReconciliationStats(items),
      ignoredExternalRecords,
      ignoredTravelRecords,
    },
  };
}

export function refreshEventualityReconciliation(reconciliation = {}) {
  const items = (reconciliation.items ?? []).filter((item) => {
    if (item.tipoExterno === EVENTUALITY_TYPES.TRAVEL) return false;
    if (isInformationalEventuality(item.tipoExternoLabel)) return false;
    const attendanceTypes = item.tiposAsistencia ?? [];
    return !attendanceTypes.length || attendanceTypes.some(
      (type) => type !== EVENTUALITY_TYPES.TRAVEL,
    );
  });
  const pendingItems = items.filter(needsManualReview);
  return {
    ...reconciliation,
    items,
    pendingItems,
    stats: {
      ...buildReconciliationStats(items, reconciliation.stats),
      ignoredExternalRecords: reconciliation.stats?.ignoredExternalRecords ?? 0,
      ignoredTravelRecords: reconciliation.stats?.ignoredTravelRecords ?? 0,
    },
  };
}
