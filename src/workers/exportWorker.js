import { exportAttendanceReport } from '../utils/excelExporter.js';

function post(type, payload = {}, transfer = []) {
  self.postMessage({ type, payload }, transfer);
}

function toTransferableArrayBuffer(value) {
  if (value instanceof ArrayBuffer) return value;

  if (ArrayBuffer.isView(value)) {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  }

  return new Blob([value]).arrayBuffer();
}

self.onmessage = async (event) => {
  const { type, payload } = event.data ?? {};

  if (type !== 'export') return;

  try {
    const buffer = await exportAttendanceReport(payload.result);
    const transferableBuffer = await toTransferableArrayBuffer(buffer);
    post('export:success', { buffer: transferableBuffer }, [transferableBuffer]);
  } catch (error) {
    post('export:error', {
      message: error?.message || 'No se pudo generar el Excel.',
    });
  }
};
