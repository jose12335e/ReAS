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
import {
  applyAutomaticEventualityDecisions,
} from '../utils/auditRules.js';
import {
  buildEventualityReconciliation,
  parseEventualitiesWorkbook,
  previewEventualitiesWorkbook,
} from '../utils/eventualitiesReader.js';

let cachedRows = [];
let cachedHeaders = [];
let cachedSheetName = '';

function post(type, payload = {}) {
  self.postMessage({ type, payload });
}

function sendError(error) {
  post('error', {
    message: error?.message || 'Ocurrió un error inesperado durante el procesamiento.',
    stack: error?.stack,
  });
}

self.onmessage = async (event) => {
  const { type, payload } = event.data ?? {};

  try {
    if (type === 'preview') {
      post('progress', { value: 8, label: 'Leyendo archivo Excel' });
      const parsed = parseExcelArrayBuffer(payload.arrayBuffer);
      cachedRows = parsed.rows;
      cachedHeaders = parsed.headers;
      cachedSheetName = parsed.sheetName;
      const availableMonths = detectAvailableMonths(parsed.rows, parsed.mapping);
      post('progress', { value: 100, label: 'Vista previa lista' });
      post('preview:success', {
        ...parsed,
        availableMonths,
        selectedMonth: availableMonths[0] ?? null,
      });
      return;
    }

    if (type === 'months') {
      const availableMonths = detectAvailableMonths(cachedRows, payload.mapping);
      post('months:success', {
        availableMonths,
        selectedMonth: availableMonths[0] ?? null,
      });
      return;
    }

    if (type === 'aux-preview') {
      const { kind, files = [], file = null, evaluationMonth = null } = payload;
      if (kind === 'extended') {
        post('aux-preview:success', {
          kind,
          files: files.map((currentFile, index) => ({
            id: currentFile.id ?? `${currentFile.name}-${index}`,
            ...previewExtendedScheduleWorkbook(
              currentFile.arrayBuffer,
              currentFile.name,
              evaluationMonth,
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
      post('progress', { value: 28, label: 'Detectando empleados con horario extendido' });
      const extendedSchedule = parseExtendedScheduleFiles(
        payload.extendedScheduleFiles ?? [],
        rows,
        payload.mapping,
        selectedMonth,
      );
      post('progress', { value: 34, label: 'Cruzando datos de nómina' });
      const payroll = parsePayrollWorkbook(
        payload.payrollFile?.arrayBuffer,
        payload.payrollFile?.name,
        extendedSchedule.evaluationMonth,
        payload.payrollFile?.options,
      );
      post('progress', { value: 39, label: 'Cruzando Excel de eventualidades' });
      const eventualities = parseEventualitiesWorkbook(
        payload.eventualitiesFile?.arrayBuffer,
        payload.eventualitiesFile?.name,
        selectedMonth ?? extendedSchedule.evaluationMonth,
        payload.eventualitiesFile?.options,
      );
      post('progress', { value: 46, label: 'Aplicando reglas de asistencia' });
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
      const resultWithEventualities = {
        ...processedResult,
        eventualityAudit,
      };
      post('progress', { value: 70, label: 'Clasificando eventualidades confirmadas' });
      const result = applyAutomaticEventualityDecisions(resultWithEventualities);
      post('progress', { value: 78, label: 'Construyendo resúmenes' });
      post('progress', { value: 100, label: 'Procesamiento completado' });
      const availableMonths = detectAvailableMonths(cachedRows, payload.mapping);
      post('process:success', {
        ...result,
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
            ...extendedSchedule.warnings,
            ...payroll.warnings,
            ...eventualities.warnings,
          ],
        },
      });
      return;
    }

    if (type === 'reset') {
      cachedRows = [];
      cachedHeaders = [];
      cachedSheetName = '';
      post('reset:success');
    }
  } catch (error) {
    sendError(error);
  }
};
