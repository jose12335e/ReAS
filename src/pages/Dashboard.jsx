import { Loader2, Play, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ColumnMapper from '../components/ColumnMapper.jsx';
import DataPreview from '../components/DataPreview.jsx';
import ExportButton from '../components/ExportButton.jsx';
import SummaryCards from '../components/SummaryCards.jsx';
import UploadExcel from '../components/UploadExcel.jsx';
import { scheduleConfig } from '../config/scheduleConfig.js';
import { useAttendanceStore } from '../store/attendanceStore.js';
import { validateColumnMapping } from '../utils/validationRules.js';

function ProgressBar({ progress, status }) {
  if (!status) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Loader2 className="h-4 w-4 animate-spin text-teal-700" />
          {status}
        </div>
        <span className="text-sm font-semibold text-slate-700">{progress}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-teal-700 transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const workerRef = useRef(null);
  const [primaryFile, setPrimaryFile] = useState(null);
  const [secondaryFiles, setSecondaryFiles] = useState([]);
  const [preview, setPreview] = useState({ headers: [], previewRows: [], rows: [] });
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [restoredFromStorage, setRestoredFromStorage] = useState(false);

  const {
    defaultScheduleType,
    dghCode,
    mapping,
    lastResult,
    lastSession,
    setDefaultScheduleType,
    setDghCode,
    setMapping,
    setLastResult,
    clearLastResult,
  } = useAttendanceStore();

  const mappingValidation = useMemo(() => validateColumnMapping(mapping), [mapping]);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/attendanceWorker.js', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const { type, payload } = event.data ?? {};

      if (type === 'progress') {
        setProgress(payload.value);
        setStatus(payload.label);
      }

      if (type === 'preview:success') {
        setPreview(payload);
        setMapping(payload.mapping);
        setResult(null);
        setRestoredFromStorage(false);
        clearLastResult();
        setErrors(payload.validation?.errors ?? []);
        setIsBusy(false);
        setStatus('');
      }

      if (type === 'process:success') {
        setResult(payload);
        setRestoredFromStorage(false);
        setErrors([]);
        setIsBusy(false);
        setStatus('');
        try {
          setLastResult(payload);
        } catch (storageError) {
          setErrors([
            'El reporte fue procesado y ya puedes descargarlo. No se pudo guardar la sesión completa en localStorage por límite del navegador.',
          ]);
        }
      }

      if (type === 'validation:error') {
        setErrors(payload.errors ?? ['Mapeo inválido.']);
        setIsBusy(false);
        setStatus('');
      }

      if (type === 'error') {
        setErrors([payload.message]);
        setIsBusy(false);
        setStatus('');
      }
    };

    return () => worker.terminate();
  }, [clearLastResult, setLastResult, setMapping]);

  useEffect(() => {
    if (!result && lastResult) {
      setResult(lastResult);
      setRestoredFromStorage(true);
    }
  }, [lastResult, result]);

  async function handlePrimaryFile(file) {
    if (!file) return;
    setPrimaryFile(file);
    setResult(null);
    setRestoredFromStorage(false);
    clearLastResult();
    setErrors([]);
    setRestoredFromStorage(false);
    setIsBusy(true);
    setProgress(0);
    setStatus('Preparando lectura del archivo');
    const arrayBuffer = await file.arrayBuffer();
    workerRef.current?.postMessage({ type: 'preview', payload: { arrayBuffer } }, [arrayBuffer]);
  }

  async function processFile() {
    if (!mappingValidation.isValid) {
      setErrors(mappingValidation.errors);
      return;
    }

    setErrors([]);
    setIsBusy(true);
    setProgress(0);
    setStatus('Iniciando procesamiento');

    try {
      const extendedScheduleFiles = await Promise.all(
        secondaryFiles.map(async (file) => ({
          name: file.name,
          arrayBuffer: await file.arrayBuffer(),
        })),
      );
      const transferList = extendedScheduleFiles.map((file) => file.arrayBuffer);

      workerRef.current?.postMessage(
        {
          type: 'process',
          payload: {
            mapping,
            defaultScheduleType,
            extendedScheduleFiles,
          },
        },
        transferList,
      );
    } catch (error) {
      setErrors([error?.message || 'No se pudo leer el Excel de horario extendido.']);
      setIsBusy(false);
      setStatus('');
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-teal-800">
              <ShieldCheck className="h-6 w-6" />
              <span className="text-sm font-semibold uppercase tracking-wide">ReAS</span>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
              Procesamiento de asistencia
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Lectura de Excel en Web Worker, reglas configurables por horario y exportación multihoja con ExcelJS.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(180px,230px)_minmax(230px,300px)_auto] sm:items-end">
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Horario base
              </span>
              <select
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                value={defaultScheduleType}
                disabled={isBusy}
                onChange={(event) => setDefaultScheduleType(event.target.value)}
              >
                {Object.values(scheduleConfig).map((schedule) => (
                  <option key={schedule.id} value={schedule.id}>
                    {schedule.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                No. DGH del reporte
              </span>
              <input
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                type="text"
                value={dghCode}
                disabled={isBusy}
                placeholder="JCE-DGH-6064-2026"
                onChange={(event) => setDghCode(event.target.value)}
              />
            </label>
            <ExportButton result={result} disabled={isBusy} reportOptions={{ dghCode }} />
          </div>
        </header>

        <UploadExcel
          primaryFile={primaryFile}
          secondaryFiles={secondaryFiles}
          disabled={isBusy}
          onPrimaryFile={handlePrimaryFile}
          onSecondaryFiles={setSecondaryFiles}
        />

        <ProgressBar progress={progress} status={status} />

        {errors.length ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {errors.map((error) => (
              <div key={error}>{error}</div>
            ))}
          </div>
        ) : null}

        {restoredFromStorage && lastSession && result ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Resultado recuperado de localStorage: {lastSession.processedRows.toLocaleString()} fila(s)
            procesada(s).
          </div>
        ) : null}

        {result?.metadata?.extendedSchedule?.files?.length ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
            <div className="font-semibold">
              Horario extendido detectado por CODIGO:{' '}
              {result.metadata.extendedSchedule.extendedEmployeeCodes.length} empleado(s)
            </div>
            <div className="mt-1">
              Mes evaluado: {result.metadata.extendedSchedule.evaluationMonth?.label ?? 'no detectado'}.
            </div>
            {result.metadata.extendedSchedule.files.map((file) => (
              <div key={`${file.fileName}-${file.sheetName}`} className="mt-1">
                {file.fileName}: hoja "{file.sheetName}", columna "{file.codeHeader ?? 'no detectada'}".
              </div>
            ))}
            {result.metadata.warnings?.map((warning) => (
              <div key={warning} className="mt-1 text-amber-800">
                {warning}
              </div>
            ))}
          </div>
        ) : null}

        <ColumnMapper
          headers={preview.headers}
          mapping={mapping}
          disabled={isBusy}
          onChange={setMapping}
        />

        {preview.headers.length ? (
          <div className="flex justify-end">
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              type="button"
              disabled={isBusy || !mappingValidation.isValid}
              onClick={processFile}
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Procesar asistencia
            </button>
          </div>
        ) : null}

        <SummaryCards result={result} />

        {result ? (
          <DataPreview
            rows={result.summaryByEmployee}
            title="Resumen por empleado"
            description="Detalle individual listo para exportar, con subtotales disponibles en el Excel final."
          />
        ) : (
          <DataPreview
            rows={preview.previewRows}
            title="Vista previa de datos"
            description="Primeras filas detectadas antes del procesamiento."
          />
        )}
      </div>
    </main>
  );
}
