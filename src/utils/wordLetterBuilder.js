import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { parseDurationToMinutes } from './timeUtils.js';

const TEMPLATE_MAPPING_STORAGE_KEY = 'reas-word-template-mappings';
const DOCX_TEXT_FILES = /^word\/(document|header\d*|footer\d*)\.xml$/;

export const WORD_LETTER_FIELDS = [
  { key: 'codigo_dgh', label: 'Codigo DGH' },
  { key: 'mes_evaluado', label: 'Mes evaluado' },
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
  { key: 'sistema', label: 'Sistema' },
];

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
  return String(value)
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

function extractTextNodes(xml = '') {
  return [...String(xml).matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => xmlUnescape(match[1]).trim())
    .filter(Boolean);
}

function shouldSuggestText(value = '') {
  const text = String(value).trim();
  if (text.length < 2 || text.length > 140) return false;
  if (/^\{\{.+\}\}$/.test(text)) return false;
  if (/\d/.test(text)) return true;
  if (/%|:/.test(text)) return true;
  return [
    'dias',
    'horas',
    'ausentismo',
    'tardanza',
    'salida',
    'ausencia',
    'eventualidad',
    'cumplimiento',
    'trabaj',
    'reporte',
    'mes',
    'direccion',
    'departamento',
  ].some((word) => normalizeText(text).includes(word));
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
  const selectedMonth = metadata.selectedMonth?.label ?? metadata.monthLabel ?? metadata.selectedMonth?.key ?? '';

  return {
    codigo_dgh: options.dghCode ?? metadata.dghCode ?? '',
    mes_evaluado: selectedMonth || 'No detectado',
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
    fecha_generacion: new Date().toLocaleString('es-DO'),
    sistema: 'ReAS',
  };
}

export async function inspectWordTemplate(file) {
  if (!file) throw new Error('Carga una plantilla Word .docx.');
  if (!/\.docx$/i.test(file.name)) throw new Error('Solo se permiten plantillas .docx.');
  const arrayBuffer = await file.arrayBuffer();
  const zip = new PizZip(arrayBuffer);
  const textFiles = readZipTextFiles(zip);
  const text = textFiles.flatMap((fileItem) => extractTextNodes(fileItem.xml)).join('\n');
  const placeholders = [...new Set([...text.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g)].map((match) => match[1]))];
  const candidates = [...new Set(textFiles.flatMap((fileItem) => extractTextNodes(fileItem.xml)).filter(shouldSuggestText))]
    .slice(0, 80)
    .map((value, index) => ({ id: `candidate-${index}`, value }));
  return {
    fileName: file.name,
    placeholders,
    candidates,
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

function applyXmlReplacements(zip, replacements = []) {
  const activeReplacements = replacements.filter((item) => item.from && item.to != null);
  if (!activeReplacements.length) return;
  Object.keys(zip.files).forEach((path) => {
    if (!DOCX_TEXT_FILES.test(path)) return;
    const file = zip.file(path);
    if (!file) return;
    let xml = file.asText();
    activeReplacements.forEach((replacement) => {
      const from = xmlEscape(replacement.from);
      const to = xmlEscape(replacement.to);
      if (!from) return;
      xml = xml.split(from).join(to);
    });
    zip.file(path, xml);
  });
}

export async function generateWordLetter({ templateFile, data, replacements = [], outputName = 'carta-reas' }) {
  if (!templateFile) throw new Error('Carga una plantilla Word .docx.');
  if (!/\.docx$/i.test(templateFile.name)) throw new Error('Solo se permiten plantillas .docx.');
  const arrayBuffer = await templateFile.arrayBuffer();
  const zip = new PizZip(arrayBuffer);
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
  doc.render(data);
  const renderedZip = doc.getZip();
  applyXmlReplacements(renderedZip, replacements);
  const blob = renderedZip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  return {
    blob,
    fileName: `${sanitizeFileName(outputName)}.docx`,
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
