import { parseExcelArrayBuffer } from '../utils/excelReader.js';
import { processAttendanceRows } from '../utils/attendanceRules.js';
import { parseExtendedScheduleFiles } from '../utils/extendedScheduleReader.js';
import { validateColumnMapping } from '../utils/validationRules.js';

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
      post('progress', { value: 100, label: 'Vista previa lista' });
      post('preview:success', parsed);
      return;
    }

    if (type === 'process') {
      const mappingValidation = validateColumnMapping(payload.mapping);
      if (!mappingValidation.isValid) {
        post('validation:error', mappingValidation);
        return;
      }

      const rows = payload.rows || cachedRows;
      post('progress', { value: 18, label: 'Validando columnas y filas' });
      post('progress', { value: 28, label: 'Detectando empleados con horario extendido' });
      const extendedSchedule = parseExtendedScheduleFiles(
        payload.extendedScheduleFiles ?? [],
        rows,
        payload.mapping,
      );
      post('progress', { value: 34, label: 'Aplicando reglas de asistencia' });
      const result = processAttendanceRows(rows, payload.mapping, {
        defaultScheduleType: payload.defaultScheduleType,
        extendedEmployeeCodes: extendedSchedule.extendedEmployeeCodes,
      });
      post('progress', { value: 78, label: 'Construyendo resúmenes' });
      post('progress', { value: 100, label: 'Procesamiento completado' });
      post('process:success', {
        ...result,
        metadata: {
          ...result.metadata,
          headers: cachedHeaders,
          sheetName: cachedSheetName,
          extendedSchedule,
          warnings: extendedSchedule.warnings,
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
