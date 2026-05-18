import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { downloadArrayBuffer } from '../utils/excelExporter.js';

export default function ExportButton({ result, disabled, reportOptions }) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');

  async function handleExport() {
    if (!result) return;
    setError('');
    setIsExporting(true);
    try {
      const buffer = await new Promise((resolve, reject) => {
        const worker = new Worker(new URL('../workers/exportWorker.js', import.meta.url), {
          type: 'module',
        });

        worker.onmessage = (event) => {
          const { type, payload } = event.data ?? {};
          if (type === 'export:success') {
            worker.terminate();
            resolve(payload.buffer);
          }
          if (type === 'export:error') {
            worker.terminate();
            reject(new Error(payload.message));
          }
        };

        worker.onerror = (workerError) => {
          worker.terminate();
          reject(new Error(workerError.message || 'No se pudo generar el Excel.'));
        };

        worker.postMessage({ type: 'export', payload: { result, reportOptions } });
      });
      const date = new Date().toISOString().slice(0, 10);
      downloadArrayBuffer(buffer, `reporte-asistencia-${date}.xlsx`);
    } catch (exportError) {
      setError(exportError?.message || 'No se pudo exportar el reporte.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        type="button"
        disabled={disabled || !result || isExporting}
        onClick={handleExport}
      >
        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {isExporting ? 'Generando Excel...' : 'Descargar Excel final'}
      </button>
      {isExporting ? (
        <span className="text-xs text-slate-500">La generación corre en segundo plano.</span>
      ) : null}
      {error ? <span className="text-sm text-rose-700">{error}</span> : null}
    </div>
  );
}
