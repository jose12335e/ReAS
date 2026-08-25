import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { parseDurationToMinutes } from './timeUtils.js';

const TEMPLATE_MAPPING_STORAGE_KEY = 'reas-word-template-mappings';
const DOCX_TEXT_FILES = /^word\/(document|header\d*|footer\d*)\.xml$/;

export const WORD_LETTER_FIELDS = [
  { key: 'codigo_dgh', label: 'Codigo DGH' },
  { key: 'mes_evaluado', label: 'Mes evaluado' },
  { key: 'mes_evaluado_nombre', label: 'Nombre del mes evaluado' },
  { key: 'area', label: 'Area / alcance' },
  { key: 'tipo_alcance', label: 'Tipo de alcance' },
  { key: 'empleados_analizados', label: 'Empleados analizados' },
  { key: 'registros_procesados', label: 'Registros procesados' },
  { key: 'dias_a_trabajar', label: 'Dias a trabajar' },
  { key: 'dias_trabajados', label: 'Dias trabajados' },
  { key: 'porcentaje_cumplimiento_dias', label: '% cumplimiento dias' },
  { key: 'horas_a_trabajar', label: 'Horas a trabajar' },
  { key: 'horas_trabajadas', label: 'Horas trabajadas' },
  { key: 'porcentaje_cumplimiento_horas', label: '% cumplimiento horas' },
  { key: 'tasa_ausentismo', label: 'Tasa de ausentismo' },
  { key: 'ausencias', label: 'Ausencias totales' },
  { key: 'ausencias_justificadas', label: 'Ausencias justificadas' },
  { key: 'ausencias_no_justificadas', label: 'Ausencias no justificadas' },
  { key: 'tardanzas', label: 'Tardanzas totales' },
  { key: 'tardanzas_justificadas', label: 'Tardanzas justificadas' },
  { key: 'tardanzas_no_justificadas', label: 'Tardanzas no justificadas' },
  { key: 'salidas_tempranas', label: 'Salidas tempranas totales' },
  { key: 'salidas_tempranas_justificadas', label: 'Salidas tempranas justificadas' },
  { key: 'salidas_tempranas_no_justificadas', label: 'Salidas tempranas no justificadas' },
  { key: 'licencias', label: 'Licencias' },
  { key: 'permisos', label: 'Permisos' },
  { key: 'vacaciones', label: 'Vacaciones' },
  { key: 'ponches_irregulares', label: 'Ponches irregulares' },
  { key: 'ver_viatico', label: 'Ver viatico' },
  { key: 'tiempo_justificado', label: 'Tiempo justificado' },
  { key: 'tiempo_no_justificado', label: 'Tiempo no justificado' },
  { key: 'tiempo_general_eventualidades', label: 'Tiempo general eventualidades' },
  { key: 'tiempo_tardanza', label: 'Tiempo tardanza' },
  { key: 'tiempo_salida_temprana', label: 'Tiempo salida temprana' },
  { key: 'tiempo_ausencia', label: 'Tiempo ausencia' },
  { key: 'estado_auditoria', label: 'Estado auditoria' },
  { key: 'diferencia_auditoria', label: 'Diferencia auditoria' },
  { key: 'empleados_con_descuadre', label: 'Empleados con descuadre' },
  { key: 'generado_por', label: 'Generado por' },
  { key: 'cargo_generado_por', label: 'Cargo generado por' },
  { key: 'codigo_generado_por', label: 'Codigo generado por' },
  { key: 'fecha_generacion', label: 'Fecha de generacion' },
  { key: 'fecha_expedicion', label: 'Fecha de expedicion' },
  { key: 'fecha_creacion', label: 'Fecha de creacion' },
  { key: 'sistema', label: 'Sistema' },
];

const FIELD_MATCH_ALIASES = [
  ['porcentaje_cumplimiento_horas', ['porcentaje de cumplimiento horas', '% de horas trabajadas', 'cumplimiento horas', 'cumplimiento. horas']],
  ['porcentaje_cumplimiento_dias', ['porcentaje de cumplimiento dias', '% de dias trabajados', 'cumplimiento dias', 'cumplimiento. dias']],
  ['tiempo_general_eventualidades', ['tiempo general acumulado', 'tiempo acumulado de eventualidades', 'eventualidades justificadas y no justificadas']],
  ['tiempo_no_justificado', ['tiempo total no justificado', 'tiempo no trabajado no justificado', 'eventualidades no justificadas']],
  ['tiempo_justificado', ['tiempo acumulado justificado', 'tiempo no trabajado justificado', 'eventualidades justificadas registradas']],
  ['tiempo_salida_temprana', ['tiempo de salidas tempranas acumulado', 'tiempo salida temprana']],
  ['tiempo_tardanza', ['tiempo de tardanza acumulado', 'tiempo tardanza']],
  ['tiempo_ausencia', ['tiempo de ausencias acumulado', 'tiempo ausencia']],
  ['horas_a_trabajar', ['horas a trabajar', 'horas esperadas', 'total horas a trabajar']],
  ['horas_trabajadas', ['horas trabajadas', 'horas reconocidas', 'horas laboradas', 'tiempo trabajado']],
  ['dias_a_trabajar', ['dias a trabajar', 'dias laborables exigibles', 'dias asignados']],
  ['dias_trabajados', ['dias trabajados', 'dias laborados', 'dias efectivamente trabajados']],
  ['tasa_ausentismo', ['tasa de ausentismo', 'taza de ausentismo', '% de ausentismo', 'ausentismo']],
  ['salidas_tempranas', ['salidas tempranas', 'salidas anticipadas']],
  ['tardanzas', ['tardanzas']],
  ['ausencias', ['ausencias']],
  ['ponches_irregulares', ['ponches irregulares', 'ponchados irregulares']],
  ['ver_viatico', ['ver viatico', 'ver viático']],
  ['vacaciones', ['vacaciones']],
  ['licencias', ['licencias']],
  ['permisos', ['permisos']],
  ['empleados_analizados', ['empleados analizados', 'colaboradores analizados']],
  ['registros_procesados', ['registros procesados']],
  ['fecha_expedicion', ['fecha de expedicion', 'fecha expedicion', 'fecha de emision', 'fecha emision', 'fecha de creacion', 'fecha creacion']],
  ['mes_evaluado', ['mes evaluado', 'periodo evaluado', 'período evaluado']],
  ['mes_evaluado_nombre', ['mes', 'mes correspondiente', 'mes del reporte']],
  ['codigo_dgh', ['codigo dgh', 'código dgh', 'no. dgh', 'no dgh']],
];

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'setiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const MONTH_NUMBER_TO_NAME = {
  '01': 'enero',
  '02': 'febrero',
  '03': 'marzo',
  '04': 'abril',
  '05': 'mayo',
  '06': 'junio',
  '07': 'julio',
  '08': 'agosto',
  '09': 'septiembre',
  10: 'octubre',
  11: 'noviembre',
  12: 'diciembre',
};

const SUM_NUMERIC_FIELDS = [
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
  'verViatico',
  'horasEsperadas',
  'horasReconocidas',
  'horasTrabajadasReconocidas',
];

const SUM_DURATION_FIELDS = [
  'tiempoNoTrabajadoJustificado',
  'tiempoNoTrabajadoNoJustificado',
  'tiempoTardanza',
  'tiempoSalidaTemprana',
  'tiempoTardanzaNoJustificada',
  'tiempoSalidaTempranaNoJustificada',
  'tiempoAusenciaNoJustificada',
  'tiempoEventualidadJustificada',
];

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatNumber(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric.toLocaleString('es-DO') : '0';
}

function formatPercent(value) {
  const numeric = Number(value || 0);
  return `${Math.round(Number.isFinite(numeric) ? numeric : 0)}%`;
}

function getEvaluationMonthInfo(metadata = {}) {
  const rawLabel = metadata.selectedMonth?.label ?? metadata.monthLabel ?? metadata.selectedMonth?.key ?? '';
  const rawKey = metadata.selectedMonth?.key ?? '';
  const combined = [rawLabel, rawKey].filter(Boolean).join(' ');
  const normalized = normalizeText(combined);
  const namedMonth = MONTH_NAMES.find((month) => normalized.includes(month));
  const numericMonth = String(rawKey || rawLabel).match(/(?:^|\D)(0[1-9]|1[0-2])(?:\D|$)/)?.[1];
  const monthName = namedMonth === 'setiembre' ? 'septiembre' : namedMonth || MONTH_NUMBER_TO_NAME[numericMonth] || '';
  return {
    label: rawLabel || monthName || 'No detectado',
    name: monthName || rawLabel || 'No detectado',
  };
}

function minutesToDuration(totalMinutes = 0) {
  const safeMinutes = Math.max(0, Math.round(Number(totalMinutes || 0)));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:00`;
}

function hoursToDuration(value) {
  return minutesToDuration(Math.round(Number(value || 0) * 60));
}

function durationToDisplay(value) {
  return minutesToDuration(parseDurationToMinutes(value));
}

function safeNumber(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function xmlEscape(value = '') {
  return sanitizeXmlText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function xmlUnescape(value = '') {
  return String(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function sanitizeXmlText(value = '') {
  return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u0084\u0086-\u009F]/g, '');
}

function sanitizeTemplateData(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeTemplateData(item));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeTemplateData(item)]));
  }
  return sanitizeXmlText(value);
}

function sanitizeFileName(value = 'carta-reas') {
  return String(value || 'carta-reas')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .toLowerCase();
}

function readZipTextFiles(zip) {
  const files = [];
  Object.keys(zip.files).forEach((path) => {
    if (!DOCX_TEXT_FILES.test(path)) return;
    const file = zip.file(path);
    if (!file) return;
    files.push({ path, xml: file.asText() });
  });
  return files;
}

function extractPlaceholdersFromText(text = '') {
  return [...new Set([...String(text).matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g)].map((match) => match[1]))];
}

function extractPlaceholdersFromZip(zip) {
  const text = readZipTextFiles(zip)
    .flatMap((fileItem) => extractTextNodes(fileItem.xml))
    .join('\n');
  return extractPlaceholdersFromText(text);
}

function extractTextNodes(xml = '') {
  return [...String(xml).matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => xmlUnescape(match[1]).trim())
    .filter(Boolean);
}

function collapseText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function extractTextBlocks(xml = '') {
  return [...String(xml).matchAll(/<w:p[\s\S]*?<\/w:p>/g)]
    .map((match) => collapseText(extractTextNodes(match[0]).join(' ')))
    .filter(Boolean);
}

function extractSentenceBlocks(xml = '') {
  const sentences = [];
  let buffer = '';
  extractTextNodes(xml).forEach((node) => {
    buffer = collapseText([buffer, node].filter(Boolean).join(' '));
    let periodIndex = buffer.indexOf('.');
    while (periodIndex >= 0) {
      const sentence = collapseText(buffer.slice(0, periodIndex + 1));
      if (sentence) sentences.push(sentence);
      buffer = collapseText(buffer.slice(periodIndex + 1));
      periodIndex = buffer.indexOf('.');
    }
  });
  if (buffer && extractReplacementValue(buffer)) {
    sentences.push(buffer);
  }
  return sentences;
}

function uniqueBlocks(values = []) {
  const seen = new Set();
  return values.filter((value) => {
    const text = collapseText(value);
    const key = normalizeText(text);
    if (!text || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findFieldMatch(text = '') {
  const normalized = normalizeText(text);
  return FIELD_MATCH_ALIASES.find(([, aliases]) =>
    aliases.some((alias) => normalized.includes(normalizeText(alias))),
  );
}

function _extractDateValue(text = '') {
  const raw = String(text).trim();
  const datePattern = /[0-3]?\d[/-][01]?\d[/-]\d{2,4}|[0-3]?\d\s+de\s+[a-záéíóúñ]+\s+de\s+\d{4}/gi;
  const afterSeparator = raw.match(
    /[:：]\s*([0-3]?\d[/-][01]?\d[/-]\d{2,4}|[0-3]?\d\s+de\s+[a-záéíóúñ]+\s+de\s+\d{4})/i,
  );
  if (afterSeparator) return afterSeparator[1].trim();
  const values = [...raw.matchAll(datePattern)].map((match) => match[0].trim());
  return values.at(-1) ?? '';
}

function extractReplacementValue(text = '') {
  const raw = String(text).trim();
  const afterSeparator = raw.match(/[:：]\s*(-?\d{1,8}(?::\d{2}){1,2}|-?\d{1,8}(?:[.,]\d+)?\s*%|-?\d{1,8}(?:[.,]\d+)?)/);
  if (afterSeparator) return afterSeparator[1].trim();

  const values = [
    ...raw.matchAll(/-?\d{1,8}(?::\d{2}){1,2}|-?\d{1,8}(?:[.,]\d+)?\s*%|-?\d{1,8}(?:[.,]\d+)?/g),
  ].map((match) => match[0].trim());
  return values.at(-1) ?? '';
}

function _isLikelyValueOnly(text = '') {
  const raw = String(text).trim();
  return /^-?\d{1,8}(?::\d{2}){1,2}$/.test(raw) ||
    /^-?\d{1,8}(?:[.,]\d+)?\s*%$/.test(raw) ||
    /^-?\d{1,8}(?:[.,]\d+)?$/.test(raw);
}

function inferContextualField(blocks = [], index) {
  const current = normalizeText(blocks[index]);
  const previous = normalizeText(blocks.slice(Math.max(0, index - 3), index).join(' '));
  const context = `${previous} ${current}`;
  if (!current.includes('representando') && !current.includes('cumplimiento')) return null;
  if (context.includes('hora')) return ['porcentaje_cumplimiento_horas'];
  if (context.includes('dia')) return ['porcentaje_cumplimiento_dias'];
  return null;
}

const DETECTABLE_VALUE_PATTERN =
  /-?\d{1,8}(?::\d{2}){1,2}|-?\d{1,8}(?:[.,]\d+)?\s*%|-?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|-?\d{1,8}(?:[.,]\d+)?/g;

function detectNumericValuesInText(text = '') {
  const raw = String(text);
  return [...raw.matchAll(DETECTABLE_VALUE_PATTERN)]
    .map((match, occurrence) => {
      const value = match[0].trim();
      const before = collapseText(raw.slice(0, match.index));
      const after = collapseText(raw.slice((match.index ?? 0) + match[0].length));
      const contextBefore = before.slice(-120).trim();
      const contextAfter = after.slice(0, 70).trim();
      const matchContext = collapseText([contextBefore, value].filter(Boolean).join(' '));
      return {
        occurrence,
        value,
        contextBefore,
        contextAfter,
        matchContext,
      };
    })
    .filter((item) => item.contextBefore || item.contextAfter);
}

function detectTemplateValueMatches(blocks = []) {
  const seen = new Set();
  return blocks.flatMap((text, index) => {
    const numbers = detectNumericValuesInText(text);
    if (!numbers.length) return [];
    return numbers.flatMap((numberMatch) => {
      const contextText = collapseText([numberMatch.contextBefore, numberMatch.value].filter(Boolean).join(' '));
      const fieldMatch = findFieldMatch(contextText) ?? findFieldMatch(text) ?? inferContextualField(blocks, index);
      const [fieldKey = ''] = fieldMatch ?? [];
      const key = `${fieldKey || 'manual'}::${numberMatch.matchContext}::${numberMatch.value}::${numberMatch.occurrence}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [
        {
          id: `number-${index}-${numberMatch.occurrence}`,
          blockIndex: index,
          occurrence: numberMatch.occurrence,
          fieldKey,
          label: fieldKey ? WORD_LETTER_FIELDS.find((field) => field.key === fieldKey)?.label ?? fieldKey : '',
          text: numberMatch.contextBefore || text,
          contextBefore: numberMatch.contextBefore,
          contextAfter: numberMatch.contextAfter,
          replaceText: numberMatch.matchContext || numberMatch.value,
          oldValue: numberMatch.value,
        },
      ];
    });
  });
}

function buildPreviewBlocks(blocks = [], matches = []) {
  const matchByBlock = new Map();
  matches.forEach((match) => {
    if (!matchByBlock.has(match.blockIndex)) matchByBlock.set(match.blockIndex, []);
    matchByBlock.get(match.blockIndex).push(match);
  });

  return blocks.map((text, blockIndex) => {
    const matchesForBlock = matchByBlock.get(blockIndex) ?? [];
    let occurrence = 0;
    let cursor = 0;
    const parts = [];
    String(text).replace(DETECTABLE_VALUE_PATTERN, (value, ...args) => {
      const offset = args.at(-2);
      const match = matchesForBlock.find((item) => item.occurrence === occurrence);
      if (offset > cursor) {
        parts.push({ type: 'text', text: String(text).slice(cursor, offset) });
      }
      parts.push({
        type: 'number',
        text: value,
        matchId: match?.id ?? null,
        approved: false,
      });
      cursor = offset + value.length;
      occurrence += 1;
      return value;
    });
    if (cursor < String(text).length) {
      parts.push({ type: 'text', text: String(text).slice(cursor) });
    }
    return {
      id: `block-${blockIndex}`,
      text,
      parts: parts.length ? parts : [{ type: 'text', text }],
    };
  });
}

function aggregateEmployees(rows = [], base = {}) {
  const aggregate = { ...base };
  SUM_NUMERIC_FIELDS.forEach((field) => {
    aggregate[field] = rows.reduce((total, row) => total + safeNumber(row[field]), 0);
  });
  SUM_DURATION_FIELDS.forEach((field) => {
    aggregate[field] = minutesToDuration(rows.reduce((total, row) => total + parseDurationToMinutes(row[field]), 0));
  });
  const horas = safeNumber(aggregate.horasReconocidas || aggregate.horasTrabajadasReconocidas);
  aggregate.horasReconocidas = horas;
  aggregate.horasTrabajadasReconocidas = horas;
  aggregate.tasaAusentismo =
    safeNumber(aggregate.horasEsperadas) > 0 ? 100 - (horas / safeNumber(aggregate.horasEsperadas)) * 100 : 0;
  return aggregate;
}

function groupedOptions(result, field, type, labelPrefix) {
  const groups = new Map();
  (result?.summaryByEmployee ?? []).forEach((employee) => {
    const value = String(employee?.[field] || '').trim();
    if (!value) return;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(employee);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([value, rows]) => ({
      id: `${type}:${value}`,
      type,
      label: `${labelPrefix}: ${value}`,
      area: value,
      row: aggregateEmployees(rows, { [field]: value, alcance: value }),
      employeeCount: rows.length,
    }));
}

export function buildLetterScopeOptions(result) {
  if (!result) return [];
  const general = {
    id: 'general',
    type: 'general',
    label: 'Total general',
    area: 'Total general',
    row: result.summaryGeneral ?? {},
    employeeCount: result.summaryByEmployee?.length ?? 0,
  };
  const locations = (result.summaryByLocation ?? []).map((row) => ({
    id: `ubicacion:${row.ubicacion}`,
    type: 'ubicacion',
    label: `Ubicacion: ${row.ubicacion}`,
    area: row.ubicacion,
    row,
    employeeCount: (result.summaryByEmployee ?? []).filter((employee) => employee.ubicacion === row.ubicacion).length,
  }));
  const departments = groupedOptions(result, 'departamento', 'departamento', 'Departamento').filter(
    (option) => !locations.some((location) => location.area === option.area),
  );
  return [general, ...locations, ...departments];
}

export function buildLetterData(result, scopeOption, options = {}) {
  const summary = scopeOption?.row ?? result?.summaryGeneral ?? {};
  const metadata = result?.metadata ?? {};
  const audit = result?.audit ?? {};
  const generatedBy = options.generatedBy ?? {};
  const expectedHours = safeNumber(summary.horasEsperadas);
  const recognizedHours = safeNumber(summary.horasReconocidas ?? summary.horasTrabajadasReconocidas);
  const diasATrabajar = safeNumber(summary.diasATrabajar);
  const diasTrabajados = safeNumber(summary.diasTrabajadosCompletos);
  const totalAusencias = safeNumber(summary.ausenciasJustificadas) + safeNumber(summary.ausenciasNoJustificadas);
  const totalTardanzas = safeNumber(summary.tardanzasJustificadas) + safeNumber(summary.tardanzasNoJustificadas);
  const totalSalidas =
    safeNumber(summary.salidasTempranasJustificadas) + safeNumber(summary.salidasTempranasNoJustificadas);
  const justifiedMin =
    parseDurationToMinutes(summary.tiempoNoTrabajadoJustificado) ||
    parseDurationToMinutes(summary.tiempoEventualidadJustificada);
  const unjustifiedMin = parseDurationToMinutes(summary.tiempoNoTrabajadoNoJustificado);
  const absenceMin =
    parseDurationToMinutes(summary.tiempoAusenciaNoJustificada) +
    parseDurationToMinutes(summary.tiempoAusenciaJustificada);
  const selectedMonth = getEvaluationMonthInfo(metadata);
  const now = new Date();
  const expeditionDate = now.toLocaleDateString('es-DO');

  return {
    codigo_dgh: options.dghCode ?? metadata.dghCode ?? '',
    mes_evaluado: selectedMonth.label,
    mes_evaluado_nombre: selectedMonth.name,
    area: scopeOption?.area ?? 'Total general',
    tipo_alcance: scopeOption?.type === 'general' ? 'Total general' : scopeOption?.type ?? 'alcance',
    empleados_analizados: formatNumber(scopeOption?.employeeCount ?? result?.summaryByEmployee?.length ?? 0),
    registros_procesados: formatNumber(metadata.processedRows ?? result?.processedRows?.length ?? 0),
    dias_a_trabajar: formatNumber(diasATrabajar),
    dias_trabajados: formatNumber(diasTrabajados),
    porcentaje_cumplimiento_dias: formatPercent(diasATrabajar > 0 ? (diasTrabajados / diasATrabajar) * 100 : 0),
    horas_a_trabajar: hoursToDuration(expectedHours),
    horas_trabajadas: hoursToDuration(recognizedHours),
    porcentaje_cumplimiento_horas: formatPercent(expectedHours > 0 ? (recognizedHours / expectedHours) * 100 : 0),
    tasa_ausentismo: formatPercent(summary.tasaAusentismo),
    ausencias: formatNumber(totalAusencias),
    ausencias_justificadas: formatNumber(summary.ausenciasJustificadas),
    ausencias_no_justificadas: formatNumber(summary.ausenciasNoJustificadas),
    tardanzas: formatNumber(totalTardanzas),
    tardanzas_justificadas: formatNumber(summary.tardanzasJustificadas),
    tardanzas_no_justificadas: formatNumber(summary.tardanzasNoJustificadas),
    salidas_tempranas: formatNumber(totalSalidas),
    salidas_tempranas_justificadas: formatNumber(summary.salidasTempranasJustificadas),
    salidas_tempranas_no_justificadas: formatNumber(summary.salidasTempranasNoJustificadas),
    licencias: formatNumber(summary.licencias),
    permisos: formatNumber(summary.permisos),
    vacaciones: formatNumber(summary.vacaciones),
    ponches_irregulares: formatNumber(summary.ponchesIrregulares),
    ver_viatico: formatNumber(summary.verViatico),
    tiempo_justificado: minutesToDuration(justifiedMin),
    tiempo_no_justificado: minutesToDuration(unjustifiedMin),
    tiempo_general_eventualidades: minutesToDuration(justifiedMin + unjustifiedMin),
    tiempo_tardanza: durationToDisplay(summary.tiempoTardanza),
    tiempo_salida_temprana: durationToDisplay(summary.tiempoSalidaTemprana),
    tiempo_ausencia: minutesToDuration(absenceMin),
    estado_auditoria: audit.general?.estadoCuadre ?? 'No disponible',
    diferencia_auditoria: audit.general?.diferencia ?? 'No disponible',
    empleados_con_descuadre: formatNumber(audit.general?.empleadosConDescuadre),
    generado_por: generatedBy.name ?? '',
    cargo_generado_por: generatedBy.role ?? '',
    codigo_generado_por: generatedBy.code ?? '',
    fecha_generacion: now.toLocaleString('es-DO'),
    fecha_expedicion: expeditionDate,
    fecha_creacion: expeditionDate,
    sistema: 'ReAS',
  };
}

export async function inspectWordTemplate(file) {
  if (!file) throw new Error('Carga una plantilla Word .docx.');
  if (!/\.docx$/i.test(file.name)) throw new Error('Solo se permiten plantillas .docx.');
  const arrayBuffer = await file.arrayBuffer();
  const zip = new PizZip(arrayBuffer);
  const textFiles = readZipTextFiles(zip);
  const textNodes = textFiles.flatMap((fileItem) => extractTextNodes(fileItem.xml));
  const textBlocks = textFiles.flatMap((fileItem) => extractTextBlocks(fileItem.xml));
  const sentenceBlocks = textFiles.flatMap((fileItem) => extractSentenceBlocks(fileItem.xml));
  const searchBlocks = uniqueBlocks(textBlocks.length ? textBlocks : [...sentenceBlocks, ...textNodes]);
  const text = searchBlocks.join('\n');
  const placeholders = extractPlaceholdersFromText(text);
  const detectedMatches = detectTemplateValueMatches(searchBlocks);
  const previewBlocks = buildPreviewBlocks(searchBlocks, detectedMatches);
  const candidates = detectedMatches
    .map((match) => ({
      id: match.id,
      value: match.text,
      oldValue: match.oldValue,
      fieldKey: match.fieldKey,
      label: match.label,
      contextBefore: match.contextBefore,
      contextAfter: match.contextAfter,
    }))
    .slice(0, 80);
  return {
    fileName: file.name,
    placeholders,
    candidates,
    detectedMatches,
    previewBlocks,
    hasPlaceholders: placeholders.length > 0,
  };
}

export function loadTemplateMappings(templateName = '') {
  try {
    const record = JSON.parse(localStorage.getItem(TEMPLATE_MAPPING_STORAGE_KEY) || '{}');
    return record[templateName] ?? { replacements: {} };
  } catch {
    return { replacements: {} };
  }
}

export function saveTemplateMappings(templateName = '', mapping = {}) {
  if (!templateName) return;
  try {
    const record = JSON.parse(localStorage.getItem(TEMPLATE_MAPPING_STORAGE_KEY) || '{}');
    record[templateName] = {
      ...mapping,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(TEMPLATE_MAPPING_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // El mapeo es una ayuda; la generacion no debe fallar si localStorage no esta disponible.
  }
}

function buildTextNodes(xml = '') {
  return [...String(xml).matchAll(/<w:t([^>]*)>([\s\S]*?)<\/w:t>/g)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    open: `<w:t${match[1]}>`,
    close: '</w:t>',
    text: xmlUnescape(match[2]),
  }));
}

function replaceSingleTextNode(xml = '', node, nextText = '') {
  if (!node) return xml;
  return `${xml.slice(0, node.start)}${node.open}${xmlEscape(nextText)}${node.close}${xml.slice(node.end)}`;
}

function replaceVisibleText(xml = '', replacement = {}) {
  const nodes = buildTextNodes(xml);
  const fromText = collapseText(replacement.from ?? '');
  const oldValue = String(replacement.oldValue ?? '');
  const nextValue = String(replacement.to ?? '');
  const normalizedFrom = normalizeText(fromText);
  if (!nodes.length || (!fromText && !oldValue)) return { xml, changed: false };

  for (let startIndex = 0; startIndex < nodes.length; startIndex += 1) {
    let context = '';
    for (let endIndex = startIndex; endIndex < Math.min(nodes.length, startIndex + 18); endIndex += 1) {
      context = collapseText([context, nodes[endIndex].text].filter(Boolean).join(' '));
      const normalizedContext = normalizeText(context);
      const hasContext = normalizedFrom && normalizedContext.includes(normalizedFrom);
      const hasSingleValueContext = !normalizedFrom && oldValue && nodes[endIndex].text.includes(oldValue);
      if (!hasContext && !hasSingleValueContext) continue;

      if (!oldValue) {
        if (!nodes[endIndex].text.includes(replacement.from)) return { xml, changed: false };
        return {
          xml: replaceSingleTextNode(xml, nodes[endIndex], nodes[endIndex].text.replace(replacement.from, nextValue)),
          changed: true,
        };
      }

      for (let replaceIndex = startIndex; replaceIndex <= endIndex; replaceIndex += 1) {
        if (!nodes[replaceIndex].text.includes(oldValue)) continue;
        return {
          xml: replaceSingleTextNode(xml, nodes[replaceIndex], nodes[replaceIndex].text.replace(oldValue, nextValue)),
          changed: true,
        };
      }
    }
  }

  return { xml, changed: false };
}

function applyAssistedReplacements(zip, replacements = []) {
  const activeReplacements = replacements.filter((item) => item.from && item.to != null);
  const skippedReplacements = [];
  if (!activeReplacements.length) return { skippedReplacements };
  Object.keys(zip.files).forEach((path) => {
    if (!DOCX_TEXT_FILES.test(path)) return;
    const file = zip.file(path);
    if (!file) return;
    let xml = file.asText();
    activeReplacements.forEach((replacement) => {
      const result = replaceVisibleText(xml, replacement);
      if (result.changed) {
        xml = result.xml;
      } else {
        skippedReplacements.push(replacement);
      }
    });
    zip.file(path, xml);
  });
  return { skippedReplacements };
}

function validateGeneratedWordXml(zip) {
  if (typeof DOMParser === 'undefined') return;
  const parser = new DOMParser();
  Object.keys(zip.files).forEach((path) => {
    if (!DOCX_TEXT_FILES.test(path)) return;
    const file = zip.file(path);
    if (!file) return;
    const xml = file.asText();
    const parsed = parser.parseFromString(xml, 'application/xml');
    const parserError = parsed.querySelector('parsererror');
    if (parserError) {
      throw new Error(`La carta genero XML invalido en ${path}. Revisa los reemplazos detectados o usa campos {{ }}.`);
    }
  });
}

export async function generateWordLetter({ templateFile, data, replacements = [], outputName = 'carta-reas' }) {
  if (!templateFile) throw new Error('Carga una plantilla Word .docx.');
  if (!/\.docx$/i.test(templateFile.name)) throw new Error('Solo se permiten plantillas .docx.');
  const arrayBuffer = await templateFile.arrayBuffer();
  const zip = new PizZip(arrayBuffer);
  const placeholders = extractPlaceholdersFromZip(zip);
  let renderedZip = zip;
  if (placeholders.length) {
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: {
        start: '{{',
        end: '}}',
      },
      nullGetter() {
        return '';
      },
    });
    doc.render(sanitizeTemplateData(data));
    renderedZip = doc.getZip();
  }
  const { skippedReplacements } = applyAssistedReplacements(renderedZip, replacements);
  validateGeneratedWordXml(renderedZip);
  const blob = renderedZip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  return {
    blob,
    fileName: `${sanitizeFileName(outputName)}.docx`,
    skippedReplacements,
  };
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
