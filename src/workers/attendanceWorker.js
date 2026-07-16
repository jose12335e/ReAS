import { parseExcelArrayBuffer } from '../utils/excelReader.js';
import { processAttendanceRows } from '../utils/attendanceRules.js';
import {
  detectAvailableMonths,
  filterRowsByEvaluationMonth,
  parseExtendedScheduleFiles,
  previewExtendedScheduleWorkbook,
} from '../utils/extendedScheduleReader.js';
import { parsePayrollWorkbook, previewPayrollWorkbook } from '../utils/payrollReader.js';
import { validateColumnMapping, validateWorkbookData } from '../utils/validationRules.js';
import { applyAutomaticEventualityDecisions } from '../utils/auditRules.js';
import {
  buildEventualityReconciliation,
  parseEventualitiesWorkbook,
  previewEventualitiesWorkbook,
} from '../utils/eventualitiesReader.js';

let cachedRows = [];
let cachedHeaders = [];
let cachedSheetName = '';
let cachedSheets = [];
let cachedArrayBuffer = null;

function post(type, payload = {}) {
  self.postMessage({ type, payload });
}

function sendError(error) {
  post('error', {
    message: error?.message || 'Ocurrio un error inesperado durante el procesamiento.',
    stack: error?.stack,
  });
}

function isAllMonthsSelection(month) {
  return Boolean(month?.all || month?.key === 'all');
}

function buildAllMonthsOption(availableMonths = []) {
  return {
    key: 'all',
    all: true,
    label: 'Todos los meses detectados',
    rowCount: availableMonths.reduce((total, month) => total + Number(month.rowCount ?? 0), 0),
    months: availableMonths,
  };
}

function withAllMonthsOption(availableMonths = []) {
  return availableMonths.length > 1 ? [buildAllMonthsOption(availableMonths), ...availableMonths] : availableMonths;
}

function monthOptionsForRows(rows, mapping) {
  return withAllMonthsOption(detectAvailableMonths(rows, mapping));
}

function processRowsForSelection(payload, rows, evaluationMonth) {
  const monthForAuxiliaries = isAllMonthsSelection(evaluationMonth) ? null : evaluationMonth;
  const extendedSchedule = parseExtendedScheduleFiles(
    payload.extendedScheduleFiles ?? [],
    rows,
    payload.mapping,
    monthForAuxiliaries,
  );
  const payroll = parsePayrollWorkbook(
    payload.payrollFile?.arrayBuffer,
    payload.payrollFile?.name,
    monthForAuxiliaries ?? extendedSchedule.evaluationMonth,
    payload.payrollFile?.options,
  );
  const eventualities = parseEventualitiesWorkbook(
    payload.eventualitiesFile?.arrayBuffer,
    payload.eventualitiesFile?.name,
    monthForAuxiliaries ?? extendedSchedule.evaluationMonth,
    payload.eventualitiesFile?.options,
  );
  const processedResult = processAttendanceRows(rows, payload.mapping, {
    defaultScheduleType: payload.defaultScheduleType,
    modifiedSchedule: payload.modifiedSchedule,
    extendedEmployeeCodes: extendedSchedule.extendedEmployeeCodes,
    payrollEmployeesByCode: payroll.employeesByCode,
    eventualitiesByCodeDate: eventualities.recordsByCodeDate,
  });
  const eventualityAudit = buildEventualityReconciliation(
    eventualities,
    processedResult.processedRows,
  );
  const result = applyAutomaticEventualityDecisions({
    ...processedResult,
    eventualityAudit,
  });

  return { result, extendedSchedule, payroll, eventualities };
}

function decorateResultMetadata({
  result,
  payload,
  selectedMonth,
  availableMonths,
  extendedSchedule,
  payroll,
  eventualities,
  extraMetadata = {},
  monthlyResults = [],
}) {
  return {
    ...result,
    monthlyResults,
    metadata: {
      ...result.metadata,
      sourceFileName: payload.primaryFileName ?? '',
      headers: cachedHeaders,
      sheetName: cachedSheetName,
      availableMonths,
      availableMonthCount: availableMonths.length,
      selectedMonth: selectedMonth ?? extendedSchedule.evaluationMonth,
      extendedSchedule,
      payroll: {
        fileName: payroll.fileName,
        sheetName: payroll.sheetName,
        rowCount: payroll.rowCount,
        employeesDetected: payroll.employeesDetected,
        mapping: payroll.mapping,
      },
      eventualities: {
        enabled: eventualities.enabled,
        fileName: eventualities.fileName,
        sheets: eventualities.sheets,
        stats: eventualities.stats,
      },
      warnings: [
        ...(result.metadata?.warnings ?? []),
        ...extendedSchedule.warnings,
        ...payroll.warnings,
        ...eventualities.warnings,
      ],
      ...extraMetadata,
    },
  };
}

function previewResponse(parsed) {
  const detectedMonths = detectAvailableMonths(parsed.rows, parsed.mapping);
  const availableMonths = withAllMonthsOption(detectedMonths);
  return {
    headers: parsed.headers,
    previewRows: parsed.previewRows,
    sheetName: parsed.sheetName,
    selectedSheetName: parsed.selectedSheetName,
    sheets: parsed.sheets ?? [],
    mapping: parsed.mapping,
    validation: parsed.validation,
    rowCount: parsed.rows.length,
    availableMonths,
    selectedMonth: detectedMonths[0] ?? availableMonths[0] ?? null,
  };
}

self.onmessage = async (event) => {
  const { type, payload } = event.data ?? {};

  try {
    if (type === 'preview') {
      post('progress', { value: 8, label: 'Leyendo archivo Excel' });
      cachedArrayBuffer = payload.arrayBuffer;
      const parsed = parseExcelArrayBuffer(cachedArrayBuffer);
      cachedRows = parsed.rows;
      cachedHeaders = parsed.headers;
      cachedSheetName = parsed.sheetName;
      cachedSheets = parsed.sheets ?? [];
      post('progress', { value: 100, label: 'Vista previa lista' });
      post('preview:success', previewResponse(parsed));
      return;
    }

    if (type === 'primary-sheet') {
      if (!cachedArrayBuffer && !payload.arrayBuffer) {
        post('error', { message: 'No se encontro el Excel principal para cambiar la hoja.' });
        return;
      }
      if (payload.arrayBuffer) cachedArrayBuffer = payload.arrayBuffer;
      const parsed = parseExcelArrayBuffer(cachedArrayBuffer, payload.sheetName);
      cachedRows = parsed.rows;
      cachedHeaders = parsed.headers;
      cachedSheetName = parsed.sheetName;
      cachedSheets = parsed.sheets ?? [];
      post('preview:success', previewResponse(parsed));
      return;
    }

    if (type === 'months') {
      const availableMonths = monthOptionsForRows(cachedRows, payload.mapping);
      const detectedMonths = availableMonths.filter((month) => !month.all);
      post('months:success', {
        availableMonths,
        selectedMonth: detectedMonths[0] ?? availableMonths[0] ?? null,
      });
      return;
    }

    if (type === 'aux-preview') {
      const { kind, files = [], file = null, evaluationMonth = null } = payload;
      const monthForPreview = isAllMonthsSelection(evaluationMonth) ? null : evaluationMonth;
      if (kind === 'extended') {
        post('aux-preview:success', {
          kind,
          files: files.map((currentFile, index) => ({
            id: currentFile.id ?? `${currentFile.name}-${index}`,
            ...previewExtendedScheduleWorkbook(
              currentFile.arrayBuffer,
              currentFile.name,
              monthForPreview,
            ),
          })),
        });
        return;
      }
      if (kind === 'payroll') {
        post('aux-preview:success', {
          kind,
          file: previewPayrollWorkbook(file?.arrayBuffer, file?.name),
        });
        return;
      }
      if (kind === 'eventualities') {
        post('aux-preview:success', {
          kind,
          file: previewEventualitiesWorkbook(file?.arrayBuffer, file?.name),
        });
        return;
      }
    }

    if (type === 'process') {
      const mappingValidation = validateColumnMapping(payload.mapping);
      if (!mappingValidation.isValid) {
        post('validation:error', mappingValidation);
        return;
      }

      const selectedMonth = payload.selectedMonth ?? null;
      const rows = filterRowsByEvaluationMonth(payload.rows || cachedRows, payload.mapping, selectedMonth);
      post('progress', { value: 18, label: 'Validando columnas y filas' });
      const workbookValidation = validateWorkbookData(rows, payload.mapping);
      if (!workbookValidation.isValid) {
        post('validation:error', workbookValidation);
        return;
      }

      post('progress', { value: 28, label: 'Procesando asistencia' });
      const processed = processRowsForSelection(payload, rows, selectedMonth);
      const availableMonths = detectAvailableMonths(cachedRows, payload.mapping);
      let monthlyResults = [];

      if (isAllMonthsSelection(selectedMonth)) {
        monthlyResults = availableMonths.map((month, index) => {
          post('progress', {
            value: Math.min(96, 58 + index),
            label: `Procesando ${month.label}`,
          });
          const monthRows = filterRowsByEvaluationMonth(cachedRows, payload.mapping, month);
          const monthProcessed = processRowsForSelection(payload, monthRows, month);
          return decorateResultMetadata({
            result: monthProcessed.result,
            payload,
            selectedMonth: month,
            availableMonths,
            extendedSchedule: monthProcessed.extendedSchedule,
            payroll: monthProcessed.payroll,
            eventualities: monthProcessed.eventualities,
          });
        });
      }

      post('progress', { value: 100, label: 'Procesamiento completado' });
      post('process:success', decorateResultMetadata({
        result: processed.result,
        payload,
        selectedMonth,
        availableMonths,
        extendedSchedule: processed.extendedSchedule,
        payroll: processed.payroll,
        eventualities: processed.eventualities,
        monthlyResults,
        extraMetadata: {
          monthSelectionMode: isAllMonthsSelection(selectedMonth) ? 'all' : 'single',
          multiMonthReportMode: payload.multiMonthReportMode ?? 'separated',
          monthlyResultCount: monthlyResults.length,
        },
      }));
      return;
    }

    if (type === 'reset') {
      cachedRows = [];
      cachedHeaders = [];
      cachedSheetName = '';
      cachedSheets = [];
      cachedArrayBuffer = null;
      post('reset:success');
    }
  } catch (error) {
    sendError(error);
  }
};
