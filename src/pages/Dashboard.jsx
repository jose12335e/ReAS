import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  FileCheck2,
  FileText,
  Loader2,
  Play,
  Settings,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import AuditReviewPanel from '../components/AuditReviewPanel.jsx';
import ColumnMapper from '../components/ColumnMapper.jsx';
import DashboardOverview from '../components/DashboardOverview.jsx';
import DataPreview from '../components/DataPreview.jsx';
import EmployeeAlerts from '../components/EmployeeAlerts.jsx';
import ReportsPanel from '../components/ReportsPanel.jsx';
import ResultsExplorer from '../components/ResultsExplorer.jsx';
import RulesPanel from '../components/RulesPanel.jsx';
import UploadExcel from '../components/UploadExcel.jsx';
import { scheduleConfig } from '../config/scheduleConfig.js';
import { useAttendanceStore } from '../store/attendanceStore.js';
import { applyAuditAdjustment } from '../utils/auditRules.js';
import { validateColumnMapping } from '../utils/validationRules.js';

function ProgressBar({ progress, status }) {
  if (!status) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-teal-50 text-teal-700">
            <Loader2 className="h-4 w-4 animate-spin" />
          </span>
          {status}
        </div>
        <span className="text-sm font-semibold text-slate-700">{progress}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
        <div className="h-full rounded-full bg-teal-700 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function TabButton({ icon: Icon, label, description, active, disabled, onClick }) {
  return (
    <button
      className={`flex min-h-20 items-center gap-3 rounded-lg border p-3 text-left shadow-sm transition ${
        active
          ? 'border-teal-200 bg-white text-slate-950 shadow-slate-200/70 ring-2 ring-teal-100'
          : 'border-slate-200 bg-white/75 text-slate-600 hover:border-slate-300 hover:bg-white'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
          active ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-500'
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
      </span>
    </button>
  );
}

export default function Dashboard() {
  const workerRef = useRef(null);
  const [primaryFile, setPrimaryFile] = useState(null);
  const [secondaryFiles, setSecondaryFiles] = useState([]);
  const [payrollFile, setPayrollFile] = useState(null);
  const [preview, setPreview] = useState({ headers: [], previewRows: [], rows: [], availableMonths: [] });
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [restoredFromStorage, setRestoredFromStorage] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  const {
    defaultScheduleType,
    modifiedSchedule,
    dghCode,
    exportFilename,
    mapping,
    lastResult,
    lastSession,
    setDefaultScheduleType,
    setModifiedSchedule,
    setDghCode,
    setExportFilename,
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
        setActiveTab('upload');
        setSelectedMonth(payload.selectedMonth ?? payload.availableMonths?.[0] ?? null);
        setMapping(payload.mapping);
        setResult(null);
        setRestoredFromStorage(false);
        clearLastResult();
        setErrors(payload.validation?.errors ?? []);
        setIsBusy(false);
        setStatus('');
      }

      if (type === 'months:success') {
        setPreview((current) => ({
          ...current,
          availableMonths: payload.availableMonths ?? [],
        }));
        setSelectedMonth((current) => {
          if ((payload.availableMonths ?? []).some((month) => month.key === current?.key)) return current;
          return payload.selectedMonth ?? payload.availableMonths?.[0] ?? null;
        });
      }

      if (type === 'process:success') {
        setResult(payload);
        setActiveTab('dashboard');
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

  useEffect(() => {
    const allowedWithoutResult = ['dashboard', 'upload', 'rules'];
    if (!result && !allowedWithoutResult.includes(activeTab)) {
      setActiveTab('upload');
    }
  }, [activeTab, result]);

  useEffect(() => {
    if (!preview.headers.length || !mapping.fecha || !workerRef.current) return;
    workerRef.current.postMessage({ type: 'months', payload: { mapping } });
  }, [mapping, preview.headers.length]);

  async function handlePrimaryFile(file) {
    if (!file) return;
    if (result && !window.confirm('Ya hay un reporte procesado. ¿Deseas cargar otro archivo y limpiar el resultado actual?')) {
      return;
    }
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
      const payrollPayload = payrollFile
        ? {
            name: payrollFile.name,
            arrayBuffer: await payrollFile.arrayBuffer(),
          }
        : null;
      const transferList = [
        ...extendedScheduleFiles.map((file) => file.arrayBuffer),
        ...(payrollPayload ? [payrollPayload.arrayBuffer] : []),
      ];

      workerRef.current?.postMessage(
        {
          type: 'process',
          payload: {
            mapping,
            defaultScheduleType,
            modifiedSchedule,
            extendedScheduleFiles,
            payrollFile: payrollPayload,
            selectedMonth,
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

  function handleAuditAdjustment(employeeAudit, bucket, options) {
    setResult((current) => {
      if (!current) return current;
      const adjustedResult = applyAuditAdjustment(current, employeeAudit, bucket, options);
      try {
        setLastResult(adjustedResult);
      } catch {
        // El ajuste queda aplicado en pantalla aunque localStorage no tenga espacio suficiente.
      }
      return adjustedResult;
    });
  }

  const hasPendingAudit = Boolean(result?.audit?.hasDiscrepancies);
  const tabs = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      description: 'Métricas y gráficos generales',
      icon: BarChart3,
    },
    {
      id: 'upload',
      label: 'Cargar archivo',
      description: 'Excel, mes, mapeo y cálculo',
      icon: UploadCloud,
    },
    {
      id: 'rules',
      label: 'Reglas',
      description: 'Horarios y configuración',
      icon: Settings,
    },
    {
      id: 'results',
      label: 'Resultados',
      description: 'Tabla, filtros y consulta',
      icon: FileText,
      disabled: !result,
    },
    {
      id: 'reports',
      label: 'Reportes',
      description: 'Excel, PDF e impresión',
      icon: FileCheck2,
      disabled: !result,
    },
    {
      id: 'alerts',
      label: 'Alertas',
      description: 'Casos críticos por área',
      icon: AlertTriangle,
      disabled: !result,
    },
  ];

  return (
    <main className="min-h-screen bg-[#eef3f7]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-teal-700 text-white shadow-sm">
                  <ShieldCheck className="h-6 w-6" />
                </span>
                <div>
                  <div className="text-sm font-semibold uppercase text-teal-800">ReAS</div>
                  <div className="text-xs font-medium text-slate-500">
                    Control de asistencia institucional
                  </div>
                </div>
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
                Procesamiento de asistencia
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Lectura de Excel en Web Worker, reglas configurables por horario y exportacion
                multihoja con ExcelJS.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-teal-100 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800">
                  <FileCheck2 className="h-3.5 w-3.5" />
                  Auditoria automatica
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Mes seleccionable
                </span>
              </div>
            </div>

            <div className="grid w-full gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3 xl:w-[680px]">
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase text-slate-500">
                  Horario base
                </span>
                <select
                  className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  value={defaultScheduleType}
                  disabled={isBusy}
                  onChange={(event) => {
                    if (
                      result &&
                      !window.confirm('Cambiar el horario base limpiará el resultado actual. ¿Deseas continuar?')
                    ) {
                      return;
                    }
                    setDefaultScheduleType(event.target.value);
                    setResult(null);
                    clearLastResult();
                  }}
                >
                  {Object.values(scheduleConfig).map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>
                      {schedule.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase text-slate-500">
                  No. DGH del reporte
                </span>
                <input
                  className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  type="text"
                  value={dghCode}
                  disabled={isBusy}
                  placeholder="JCE-DGH-6064-2026"
                  onChange={(event) => setDghCode(event.target.value)}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase text-slate-500">
                  Nombre del Excel
                </span>
                <input
                  className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  type="text"
                  value={exportFilename}
                  disabled={isBusy}
                  placeholder="reporte-asistencia"
                  onChange={(event) => setExportFilename(event.target.value)}
                />
              </label>
            </div>
          </div>
        </header>

        <nav className="grid gap-3 md:grid-cols-2 xl:grid-cols-6" aria-label="Secciones del sistema">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              icon={tab.icon}
              label={tab.label}
              description={tab.description}
              active={activeTab === tab.id}
              disabled={tab.disabled}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </nav>

        {activeTab === 'dashboard' ? (
          <section className="space-y-5">
            {restoredFromStorage && lastSession && result ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
                Resultado recuperado de localStorage: {lastSession.processedRows.toLocaleString()} fila(s)
                procesada(s).
              </div>
            ) : null}

            <DashboardOverview result={result} />

            {result ? (
              <AuditReviewPanel
                audit={result.audit}
                disabled={isBusy}
                onAdjust={handleAuditAdjustment}
              />
            ) : null}
          </section>
        ) : null}

        {activeTab === 'upload' ? (
          <section className="space-y-5">
            <UploadExcel
              primaryFile={primaryFile}
              secondaryFiles={secondaryFiles}
              payrollFile={payrollFile}
              disabled={isBusy}
              onPrimaryFile={handlePrimaryFile}
              onSecondaryFiles={setSecondaryFiles}
              onPayrollFile={setPayrollFile}
            />

            <ProgressBar progress={progress} status={status} />

            {preview.availableMonths?.length ? (
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
                <label className="grid gap-1.5 sm:max-w-xs">
                  <span className="text-xs font-semibold uppercase text-slate-500">
                    Mes a calcular
                  </span>
                  <select
                    className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    value={selectedMonth?.key ?? ''}
                    disabled={isBusy}
                    onChange={(event) => {
                      const month = preview.availableMonths.find((option) => option.key === event.target.value);
                      setSelectedMonth(month ?? null);
                      setResult(null);
                      clearLastResult();
                    }}
                  >
                    {preview.availableMonths.map((month) => (
                      <option key={month.key} value={month.key}>
                        {month.label} ({month.rowCount.toLocaleString()} fila(s))
                      </option>
                    ))}
                  </select>
                </label>
              </section>
            ) : null}

            {errors.length ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
                {errors.map((error) => (
                  <div key={error}>{error}</div>
                ))}
              </div>
            ) : null}

            {result?.metadata?.extendedSchedule?.files?.length ? (
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 shadow-sm">
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
              </div>
            ) : null}

            {result?.metadata?.warnings?.length ? (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm font-medium text-orange-900">
                {result.metadata.warnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </div>
            ) : null}

            {result?.metadata?.payroll?.fileName ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm">
                <div className="font-semibold">
                  Nómina cruzada por CODIGO: {result.metadata.payroll.employeesDetected} empleado(s)
                  detectado(s)
                </div>
                <div className="mt-1">
                  {result.metadata.payroll.fileName}: hoja "{result.metadata.payroll.sheetName}",{' '}
                  {result.metadata.excludedRowsByPayroll ?? 0} fila(s) excluida(s) de cálculos.
                </div>
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
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm shadow-slate-900/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                  type="button"
                  disabled={isBusy || !mappingValidation.isValid}
                  onClick={processFile}
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Procesar asistencia
                </button>
              </div>
            ) : null}

            <DataPreview
              rows={preview.previewRows}
              title="Vista previa de datos"
              description="Primeras filas detectadas antes del procesamiento."
            />
          </section>
        ) : null}

        {activeTab === 'rules' ? (
          <RulesPanel
            defaultScheduleType={defaultScheduleType}
            modifiedSchedule={modifiedSchedule}
            disabled={isBusy}
            onModifiedScheduleChange={(nextSchedule) => {
              if (
                result &&
                !window.confirm('Modificar las reglas limpiará el resultado actual. ¿Deseas continuar?')
              ) {
                return;
              }
              setModifiedSchedule(nextSchedule);
              setResult(null);
              clearLastResult();
            }}
          />
        ) : null}

        {activeTab === 'results' ? (
          <ResultsExplorer result={result} selectedMonth={selectedMonth} />
        ) : null}

        {activeTab === 'reports' ? (
          <ReportsPanel
            result={result}
            disabled={isBusy}
            hasPendingAudit={hasPendingAudit}
            reportOptions={{ dghCode }}
            filename={exportFilename}
          />
        ) : null}

        {activeTab === 'alerts' ? <EmployeeAlerts result={result} /> : null}
      </div>
    </main>
  );
}
