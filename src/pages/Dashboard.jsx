import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  FileCheck2,
  FilePlus2,
  FileText,
  HardDrive,
  Loader2,
  LogOut,
  Play,
  Settings,
  ShieldCheck,
  UserCheck,
  UploadCloud,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import AppSidebar from '../components/AppSidebar.jsx';
import AuditReviewPanel from '../components/AuditReviewPanel.jsx';
import AuxiliaryColumnMapper from '../components/AuxiliaryColumnMapper.jsx';
import ColumnMapper from '../components/ColumnMapper.jsx';
import DashboardOverview from '../components/DashboardOverview.jsx';
import DataPreview from '../components/DataPreview.jsx';
import EmployeeAlerts from '../components/EmployeeAlerts.jsx';
import PageHeader from '../components/PageHeader.jsx';
import ReportsPanel from '../components/ReportsPanel.jsx';
import ResultsExplorer from '../components/ResultsExplorer.jsx';
import RulesPanel from '../components/RulesPanel.jsx';
import UploadExcel from '../components/UploadExcel.jsx';
import { SCHEDULE_TYPES, scheduleConfig } from '../config/scheduleConfig.js';
import { SESSION_TTL_HOURS, useAttendanceStore } from '../store/attendanceStore.js';
import { EXTENDED_SCHEDULE_FIELD_DEFINITIONS } from '../utils/extendedScheduleReader.js';
import { EVENTUALITY_FIELD_DEFINITIONS } from '../utils/eventualitiesReader.js';
import { PAYROLL_FIELD_DEFINITIONS } from '../utils/payrollReader.js';
import {
  applyAuditAdjustment,
  applyEventualityAuditDecision,
  applyManualIrregularPunch,
} from '../utils/auditRules.js';
import {
  validateColumnMapping,
  validateFileForUpload,
  validateFilesForUpload,
} from '../utils/validationRules.js';

const MAX_LOCAL_STORAGE_RESULT_ROWS = 15000;

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

function ValidationSummaryPanel({ validation, fileWarnings = [] }) {
  if (!validation && !fileWarnings.length) return null;

  const errors = validation?.errors ?? [];
  const warnings = [...fileWarnings, ...(validation?.warnings ?? [])];
  const stats = validation?.stats;
  const isValid = validation?.isValid ?? true;

  return (
    <section
      className={`rounded-lg border p-4 shadow-sm ${
        isValid
          ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
          : 'border-rose-200 bg-rose-50 text-rose-950'
      }`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
              isValid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
            }`}
          >
            {isValid ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </span>
          <div>
            <h2 className="text-sm font-semibold">
              {isValid ? 'Archivo listo para procesar' : 'Archivo con errores críticos'}
            </h2>
            <p className="mt-1 text-sm">
              {isValid
                ? 'Columnas y datos principales validados. Revisa las advertencias antes de procesar.'
                : 'Corrige los errores marcados antes de procesar la asistencia.'}
            </p>
          </div>
        </div>
        {stats ? (
          <div className="grid gap-2 text-xs font-semibold sm:grid-cols-3 lg:min-w-[360px]">
            <span className="rounded-md bg-white/70 px-3 py-2 ring-1 ring-black/5">
              {stats.rowCount.toLocaleString('es-DO')} fila(s)
            </span>
            <span className="rounded-md bg-white/70 px-3 py-2 ring-1 ring-black/5">
              {errors.length.toLocaleString('es-DO')} error(es)
            </span>
            <span className="rounded-md bg-white/70 px-3 py-2 ring-1 ring-black/5">
              {warnings.length.toLocaleString('es-DO')} advertencia(s)
            </span>
          </div>
        ) : null}
      </div>

      {errors.length ? (
        <div className="mt-4 rounded-md border border-rose-200 bg-white/75 p-3">
          <div className="text-xs font-semibold uppercase text-rose-700">Errores que bloquean</div>
          <ul className="mt-2 space-y-1 text-sm">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-white/75 p-3 text-amber-950">
          <div className="text-xs font-semibold uppercase text-amber-700">Advertencias</div>
          <ul className="mt-2 space-y-1 text-sm">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export default function Dashboard({ activeUser, onLogout }) {
  const workerRef = useRef(null);
  const persistenceTimerRef = useRef(null);
  const persistenceVersionRef = useRef(0);
  const feedbackTimerRef = useRef(null);
  const auditActionLockRef = useRef(false);
  const [primaryFile, setPrimaryFile] = useState(null);
  const [secondaryFiles, setSecondaryFiles] = useState([]);
  const [payrollFile, setPayrollFile] = useState(null);
  const [eventualitiesFile, setEventualitiesFile] = useState(null);
  const [auxiliaryPreviews, setAuxiliaryPreviews] = useState({
    extended: [],
    payroll: null,
    eventualities: null,
  });
  const [preview, setPreview] = useState({ headers: [], previewRows: [], rows: [], availableMonths: [] });
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState([]);
  const [fileWarnings, setFileWarnings] = useState([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [restoredFromStorage, setRestoredFromStorage] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [auditFeedback, setAuditFeedback] = useState(null);

  const {
    defaultScheduleType,
    modifiedSchedule,
    dghCode,
    exportFilename,
    saveSession,
    mapping,
    lastResult,
    lastSession,
    setDefaultScheduleType,
    setModifiedSchedule,
    setDghCode,
    setExportFilename,
    setSaveSession,
    setMapping,
    setLastResult,
    clearLastResult,
    clearExpiredSession,
  } = useAttendanceStore();

  const mappingValidation = useMemo(() => validateColumnMapping(mapping), [mapping]);
  const workbookValidation = useMemo(() => {
    if (!preview.headers.length) return null;
    return preview.validation ?? null;
  }, [preview.headers.length, preview.validation]);

  function canPersistFullResult(nextResult) {
    return Number(nextResult?.metadata?.processedRows ?? nextResult?.processedRows?.length ?? 0) <= MAX_LOCAL_STORAGE_RESULT_ROWS;
  }

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
        setFileWarnings([]);
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

      if (type === 'aux-preview:success') {
        setAuxiliaryPreviews((current) => {
          if (payload.kind === 'extended') {
            return { ...current, extended: payload.files ?? [] };
          }
          if (payload.kind === 'payroll') {
            return { ...current, payroll: payload.file ?? null };
          }
          if (payload.kind === 'eventualities') {
            return { ...current, eventualities: payload.file ?? null };
          }
          return current;
        });
      }

      if (type === 'process:success') {
        setResult(payload);
        setActiveTab('dashboard');
        setRestoredFromStorage(false);
        setErrors([]);
        setFileWarnings([]);
        setIsBusy(false);
        setStatus('');
        if (!canPersistFullResult(payload)) {
          setLastResult(null);
          return;
        }
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
        setFileWarnings(payload.warnings ?? []);
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

  useEffect(
    () => () => {
      if (persistenceTimerRef.current) window.clearTimeout(persistenceTimerRef.current);
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    clearExpiredSession();
  }, [clearExpiredSession]);

  useEffect(() => {
    if (saveSession && !result && lastResult) {
      setResult(lastResult);
      setRestoredFromStorage(true);
    }
  }, [lastResult, result, saveSession]);

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

  useEffect(() => {
    if (!secondaryFiles.length || !selectedMonth || !workerRef.current) return;
    requestAuxiliaryPreview('extended', async () => {
      const filePayloads = await Promise.all(
        secondaryFiles.map(async (file, index) => ({
          id: `${file.name}-${index}`,
          name: file.name,
          arrayBuffer: await file.arrayBuffer(),
        })),
      );
      return {
        payload: { files: filePayloads },
        transferList: filePayloads.map((file) => file.arrayBuffer),
      };
    });
  }, [selectedMonth?.key]);

  async function handlePrimaryFile(file) {
    if (!file) return;
    const fileValidation = validateFileForUpload(file, { required: true, label: 'Excel principal' });
    setFileWarnings(fileValidation.warnings);
    if (!fileValidation.isValid) {
      setErrors(fileValidation.errors);
      return;
    }
    if (result && !window.confirm('Ya hay un reporte procesado. ¿Deseas cargar otro archivo y limpiar el resultado actual?')) {
      return;
    }
    setPrimaryFile(file);
    setResult(null);
    setRestoredFromStorage(false);
    clearLastResult();
    setErrors([]);
    setFileWarnings(fileValidation.warnings);
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
    const auxiliaryValidation = validateAuxiliaryMappings();
    if (!auxiliaryValidation.isValid) {
      setErrors(auxiliaryValidation.errors);
      return;
    }
    if (workbookValidation && !workbookValidation.isValid) {
      setErrors(workbookValidation.errors);
      setFileWarnings(workbookValidation.warnings);
      return;
    }

    setErrors([]);
    setFileWarnings(workbookValidation?.warnings ?? []);
    setIsBusy(true);
    setProgress(0);
    setStatus('Iniciando procesamiento');

    try {
      const extendedScheduleFiles = await Promise.all(
        secondaryFiles.map(async (file, index) => ({
          name: file.name,
          arrayBuffer: await file.arrayBuffer(),
          options: previewToOptions(auxiliaryPreviews.extended[index]),
        })),
      );
      const payrollPayload = payrollFile
        ? {
            name: payrollFile.name,
            arrayBuffer: await payrollFile.arrayBuffer(),
            options: previewToOptions(auxiliaryPreviews.payroll),
          }
        : null;
      const eventualitiesPayload = eventualitiesFile
        ? {
            name: eventualitiesFile.name,
            arrayBuffer: await eventualitiesFile.arrayBuffer(),
            options: previewToOptions(auxiliaryPreviews.eventualities),
          }
        : null;
      const transferList = [
        ...extendedScheduleFiles.map((file) => file.arrayBuffer),
        ...(payrollPayload ? [payrollPayload.arrayBuffer] : []),
        ...(eventualitiesPayload ? [eventualitiesPayload.arrayBuffer] : []),
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
            eventualitiesFile: eventualitiesPayload,
            primaryFileName: primaryFile?.name ?? '',
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

  function previewToOptions(previewItem) {
    if (!previewItem) return {};
    return {
      sheetName: previewItem.selectedSheetName,
      mapping: previewItem.mapping ?? {},
    };
  }

  function validateAuxiliaryPreview(previewItem, fields, label) {
    if (!previewItem) return [];
    const mappingToValidate = previewItem.mapping ?? {};
    return fields
      .filter((field) => field.required && !mappingToValidate[field.key])
      .map((field) => `${label}: falta mapear ${field.label}.`);
  }

  function validateAuxiliaryMappings() {
    const errors = [
      ...(secondaryFiles.length && auxiliaryPreviews.extended.length !== secondaryFiles.length
        ? ['Horario extendido: espera a que termine la vista previa para confirmar columnas.']
        : []),
      ...(payrollFile && !auxiliaryPreviews.payroll
        ? ['Nómina: espera a que termine la vista previa para confirmar columnas.']
        : []),
      ...(eventualitiesFile && !auxiliaryPreviews.eventualities
        ? ['Eventualidades: espera a que termine la vista previa para confirmar columnas.']
        : []),
      ...auxiliaryPreviews.extended.flatMap((previewItem, index) =>
        validateAuxiliaryPreview(
          previewItem,
          EXTENDED_SCHEDULE_FIELD_DEFINITIONS,
          `Horario extendido ${index + 1}`,
        ),
      ),
      ...validateAuxiliaryPreview(auxiliaryPreviews.payroll, PAYROLL_FIELD_DEFINITIONS, 'Nómina'),
      ...validateAuxiliaryPreview(
        auxiliaryPreviews.eventualities,
        EVENTUALITY_FIELD_DEFINITIONS,
        'Eventualidades',
      ),
    ];
    return { isValid: errors.length === 0, errors };
  }

  async function requestAuxiliaryPreview(kind, payloadBuilder) {
    if (!workerRef.current) return;
    const { payload, transferList } = await payloadBuilder();
    workerRef.current.postMessage(
      {
        type: 'aux-preview',
        payload: {
          kind,
          evaluationMonth: selectedMonth,
          ...payload,
        },
      },
      transferList,
    );
  }

  function handleSecondaryFiles(files) {
    const validation = validateFilesForUpload(files, { label: 'Excel horario extendido' });
    setFileWarnings(validation.warnings);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    setErrors([]);
    setSecondaryFiles(files);
    setAuxiliaryPreviews((current) => ({ ...current, extended: [] }));
    requestAuxiliaryPreview('extended', async () => {
      const filePayloads = await Promise.all(
        files.map(async (file, index) => ({
          id: `${file.name}-${index}`,
          name: file.name,
          arrayBuffer: await file.arrayBuffer(),
        })),
      );
      return {
        payload: { files: filePayloads },
        transferList: filePayloads.map((file) => file.arrayBuffer),
      };
    });
  }

  function handlePayrollFile(file) {
    const validation = validateFileForUpload(file, { label: 'Excel nómina' });
    setFileWarnings(validation.warnings);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    setErrors([]);
    setPayrollFile(file);
    setAuxiliaryPreviews((current) => ({ ...current, payroll: null }));
    if (file) {
      requestAuxiliaryPreview('payroll', async () => {
        const arrayBuffer = await file.arrayBuffer();
        return {
          payload: { file: { name: file.name, arrayBuffer } },
          transferList: [arrayBuffer],
        };
      });
    }
  }

  function handleEventualitiesFile(file) {
    const validation = validateFileForUpload(file, { label: 'Excel de eventualidades' });
    setFileWarnings(validation.warnings);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    setErrors([]);
    setEventualitiesFile(file);
    setAuxiliaryPreviews((current) => ({ ...current, eventualities: null }));
    if (file) {
      requestAuxiliaryPreview('eventualities', async () => {
        const arrayBuffer = await file.arrayBuffer();
        return {
          payload: { file: { name: file.name, arrayBuffer } },
          transferList: [arrayBuffer],
        };
      });
    }
  }

  function scheduleResultPersistence(nextResult) {
    if (!saveSession) return;
    if (!canPersistFullResult(nextResult)) {
      setLastResult(null);
      return;
    }
    const persistenceVersion = ++persistenceVersionRef.current;
    if (persistenceTimerRef.current) window.clearTimeout(persistenceTimerRef.current);
    persistenceTimerRef.current = window.setTimeout(() => {
      const persist = () => {
        if (persistenceVersion !== persistenceVersionRef.current) return;
        try {
          setLastResult(nextResult);
        } catch {
          // El resultado permanece en pantalla aunque localStorage no tenga espacio suficiente.
        }
      };
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(persist, { timeout: 1200 });
      } else {
        persist();
      }
    }, 650);
  }

  function showAuditFeedback(statusValue, message, actionId) {
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    setAuditFeedback({ status: statusValue, message, actionId });
    if (statusValue !== 'processing') {
      feedbackTimerRef.current = window.setTimeout(() => setAuditFeedback(null), 2800);
    }
  }

  function executeAuditAction(actionId, processingMessage, successMessage, updater) {
    if (auditActionLockRef.current || auditFeedback?.status === 'processing') return;
    auditActionLockRef.current = true;
    showAuditFeedback('processing', processingMessage, actionId);
    window.setTimeout(() => {
      setResult((current) => {
        if (!current) {
          auditActionLockRef.current = false;
          return current;
        }
        try {
          const adjustedResult = updater(current);
          scheduleResultPersistence(adjustedResult);
          auditActionLockRef.current = false;
          window.queueMicrotask(() => showAuditFeedback('success', successMessage, actionId));
          return adjustedResult;
        } catch (error) {
          auditActionLockRef.current = false;
          window.queueMicrotask(() =>
            showAuditFeedback(
              'error',
              error?.message || 'No se pudo completar la accion de auditoria.',
              actionId,
            ),
          );
          return current;
        }
      });
    }, 0);
  }

  function handleAuditAdjustment(employeeAudit, bucket, options) {
    executeAuditAction(
      `adjust:${employeeAudit.codigo}:${bucket}:${options?.scopeLabel ?? 'total'}`,
      'Aplicando ajuste de cuadre...',
      'Ajuste aplicado y cuadre actualizado correctamente.',
      (current) => applyAuditAdjustment(current, employeeAudit, bucket, options),
    );
  }

  function handleManualIrregularPunch(employeeAudit, detail) {
    executeAuditAction(
      `irregular:${employeeAudit.codigo}:${detail?.fila ?? detail?.fecha ?? 'registro'}`,
      'Registrando ponchado irregular...',
      'Ponchado irregular registrado correctamente.',
      (current) => applyManualIrregularPunch(current, employeeAudit, detail),
    );
  }

  function handleEventualityDecision(item, decision, options) {
    const successMessages = {
      justified: 'Eventualidad pasada a justificado correctamente.',
      unjustified: 'Eventualidad pasada a no justificado correctamente.',
      irregular: 'Eventualidad convertida en ponchado irregular.',
      confirm: 'Clasificacion actual confirmada correctamente.',
      discard: 'Eventualidad descartada correctamente.',
    };
    executeAuditAction(
      `eventuality:${item.id}`,
      'Actualizando eventualidad y recalculando el empleado...',
      successMessages[decision] ?? 'Auditoria actualizada correctamente.',
      (current) => applyEventualityAuditDecision(current, item, decision, options),
    );
  }

  function handleNewReport() {
    if (
      result &&
      !window.confirm('Esto limpiará el reporte actual y la sesión guardada en localStorage. ¿Deseas continuar?')
    ) {
      return;
    }
    setPrimaryFile(null);
    setSecondaryFiles([]);
    setPayrollFile(null);
    setEventualitiesFile(null);
    setAuxiliaryPreviews({ extended: [], payroll: null, eventualities: null });
    setPreview({ headers: [], previewRows: [], rows: [], availableMonths: [] });
    setSelectedMonth(null);
    setResult(null);
    setErrors([]);
    setFileWarnings([]);
    setProgress(0);
    setStatus('');
    setIsBusy(false);
    setRestoredFromStorage(false);
    setAuditFeedback(null);
    persistenceVersionRef.current += 1;
    clearLastResult();
    setActiveTab('upload');
  }

  function handleSaveSessionChange(nextValue) {
    if (
      !nextValue &&
      lastResult &&
      !window.confirm('Desactivar Guardar sesión borrará la copia guardada en localStorage. El reporte abierto seguirá en pantalla hasta que cierres o limpies. ¿Deseas continuar?')
    ) {
      return;
    }
    setSaveSession(nextValue);
    if (!nextValue) {
      setRestoredFromStorage(false);
    }
  }

  const hasPendingAudit = Boolean(result?.audit?.hasDiscrepancies);
  const auditActionInProgress = auditFeedback?.status === 'processing';
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

  const activeTabInfo = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const pageMeta = {
    dashboard: {
      title: 'Procesamiento de asistencia',
      subtitle: 'Resumen ejecutivo, auditoría de descuadres y métricas principales del reporte.',
    },
    upload: {
      title: 'Cargar archivos',
      subtitle: 'Sube el ponchado, cruza archivos auxiliares y valida la estructura antes de procesar.',
    },
    rules: {
      title: 'Configuración de reglas',
      subtitle: 'Consulta y ajusta los horarios usados para calcular días, horas y eventualidades.',
    },
    results: {
      title: 'Resultados',
      subtitle: 'Explora la data procesada con filtros, búsqueda y lectura rápida por empleado.',
    },
    reports: {
      title: 'Reportes',
      subtitle: 'Genera el Excel institucional con trazabilidad, tablas y resúmenes.',
    },
    alerts: {
      title: 'Alertas',
      subtitle: 'Identifica colaboradores con mayor concentración de eventualidades por área.',
    },
  };
  const currentPage = pageMeta[activeTab] ?? pageMeta.dashboard;
  const headerActions = (
    <div className="grid w-full gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:grid-cols-2">
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold uppercase text-slate-500">Horario base</span>
        <select
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
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
        <span className="text-xs font-semibold uppercase text-slate-500">No. DGH del reporte</span>
        <input
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          type="text"
          value={dghCode}
          disabled={isBusy}
          placeholder="JCE-DGH-6064-2026"
          onChange={(event) => setDghCode(event.target.value)}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold uppercase text-slate-500">Nombre del Excel</span>
        <input
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          type="text"
          value={exportFilename}
          disabled={isBusy}
          placeholder="reporte-asistencia"
          onChange={(event) => setExportFilename(event.target.value)}
        />
      </label>
      <div className="grid gap-2">
        <span className="text-xs font-semibold uppercase text-slate-500">Acciones rápidas</span>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-teal-200 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={isBusy}
            onClick={handleNewReport}
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            Nuevo
          </button>
          <button
            className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
              saveSession
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
            type="button"
            role="switch"
            aria-checked={saveSession}
            disabled={isBusy}
            onClick={() => handleSaveSessionChange(!saveSession)}
          >
            <HardDrive className="h-3.5 w-3.5" />
            {saveSession ? 'Guardando' : 'No guardar'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#eef3f7]">
      <div className="flex min-h-screen">
        <AppSidebar
          tabs={tabs}
          activeTab={activeTab}
          activeUser={activeUser}
          onTabChange={setActiveTab}
          onLogout={onLogout}
        />
        <div className="min-w-0 flex-1 lg:pl-72">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/70 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-white">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-950">ReAS</div>
                <div className="text-xs font-medium text-slate-500">Gestión Humana</div>
              </div>
            </div>
            <button
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
              type="button"
              onClick={onLogout}
            >
              Salir
            </button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  activeTab === tab.id
                    ? 'bg-slate-950 text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-600'
                } ${tab.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                type="button"
                disabled={tab.disabled}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <PageHeader
          title={currentPage.title}
          subtitle={currentPage.subtitle}
          breadcrumb={['ReAS', activeTabInfo.label]}
          activeUser={activeUser}
          onLogout={onLogout}
          actions={headerActions}
        />

        <header className="hidden rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
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
                <button
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-teal-200 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={isBusy}
                  onClick={handleNewReport}
                >
                  <FilePlus2 className="h-3.5 w-3.5" />
                  Nuevo / limpiar sesión
                </button>
                <button
                  className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    saveSession
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  type="button"
                  role="switch"
                  aria-checked={saveSession}
                  disabled={isBusy}
                  onClick={() => handleSaveSessionChange(!saveSession)}
                >
                  <HardDrive className="h-3.5 w-3.5" />
                  {saveSession ? 'Guardando sesión' : 'No guardar sesión'}
                </button>
              </div>
            </div>

            <div className="grid w-full gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3 xl:w-[680px]">
              {activeUser ? (
                <div className="rounded-md border border-teal-100 bg-white p-3 sm:col-span-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-700">
                        <UserCheck className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="text-xs font-semibold uppercase text-slate-500">Sesion activa</div>
                        <div className="mt-1 text-sm font-semibold text-slate-950">{activeUser.name}</div>
                        <div className="mt-0.5 text-xs font-medium text-slate-600">
                          {activeUser.role} · {activeUser.code}
                        </div>
                      </div>
                    </div>
                    <button
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      type="button"
                      onClick={onLogout}
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              ) : null}
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

        <section
          className={`rounded-lg border p-4 text-sm shadow-sm ${
            saveSession
              ? 'border-amber-200 bg-amber-50 text-amber-950'
              : 'border-emerald-200 bg-emerald-50 text-emerald-950'
          }`}
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {saveSession
                  ? `Privacidad: este equipo conserva la última sesión por ${SESSION_TTL_HOURS} horas. Usa “Nuevo / limpiar sesión” al terminar si el equipo es compartido.`
                  : 'Privacidad: el reporte actual no se guardará en localStorage. Si recargas o cierras la página, tendrás que procesarlo de nuevo.'}
              </span>
            </div>
            {lastSession?.savedAt && saveSession ? (
              <span className="text-xs font-semibold">
                Sesión guardada: {new Date(lastSession.savedAt).toLocaleString('es-DO')}
              </span>
            ) : null}
          </div>
        </section>

        <nav className="hidden gap-3 md:grid-cols-2 xl:grid-cols-6" aria-label="Secciones del sistema">
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

            <DashboardOverview
              result={result}
              onStartUpload={() => setActiveTab('upload')}
              activeRulesCount={3}
              hasPendingAudit={hasPendingAudit}
            />

            {result ? (
              <AuditReviewPanel
                audit={result.audit}
                disabled={isBusy || auditActionInProgress}
                actionFeedback={auditFeedback}
                onAdjust={handleAuditAdjustment}
                onAddIrregularPunch={handleManualIrregularPunch}
                onEventualityDecision={handleEventualityDecision}
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
              eventualitiesFile={eventualitiesFile}
              disabled={isBusy}
              onPrimaryFile={handlePrimaryFile}
              onSecondaryFiles={handleSecondaryFiles}
              onPayrollFile={handlePayrollFile}
              onEventualitiesFile={handleEventualitiesFile}
            />

            <ProgressBar progress={progress} status={status} />

            <ValidationSummaryPanel validation={workbookValidation} fileWarnings={fileWarnings} />

            <AuxiliaryColumnMapper
              previews={auxiliaryPreviews}
              fields={{
                extended: EXTENDED_SCHEDULE_FIELD_DEFINITIONS,
                payroll: PAYROLL_FIELD_DEFINITIONS,
                eventualities: EVENTUALITY_FIELD_DEFINITIONS,
              }}
              disabled={isBusy}
              onChange={setAuxiliaryPreviews}
            />

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
                {result.metadata.missingPayrollSummary?.totalEmployees ? (
                  <div className="mt-1 font-semibold text-rose-800">
                    {result.metadata.missingPayrollSummary.totalEmployees} empleado(s) del ponchado no aparecen en nómina.
                  </div>
                ) : null}
              </div>
            ) : null}

            {result?.metadata?.eventualities?.fileName ? (
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950 shadow-sm">
                <div className="font-semibold">
                  Eventualidades cruzadas por CODIGO, fecha y tipo:{' '}
                  {result.metadata.eventualities.stats?.dailyRecords ?? 0} registro(s) diario(s)
                </div>
                <div className="mt-1">
                  {result.metadata.eventualities.fileName}:{' '}
                  {result.metadata.eventualities.sheets?.length ?? 0} hoja(s) utilizada(s),{' '}
                  {result.audit?.eventuality?.stats?.pending ?? 0} diferencia(s) pendiente(s).
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
                  disabled={isBusy || !mappingValidation.isValid || (workbookValidation && !workbookValidation.isValid)}
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
            onSelectModifiedSchedule={() => {
              if (
                result &&
                !window.confirm('Cambiar a Horario modificado limpiará el resultado actual. ¿Deseas continuar?')
              ) {
                return;
              }
              setDefaultScheduleType(SCHEDULE_TYPES.MODIFIED);
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
            reportOptions={{ dghCode, generatedBy: activeUser }}
            filename={exportFilename}
          />
        ) : null}

        {activeTab === 'alerts' ? <EmployeeAlerts result={result} /> : null}
      </div>
        </div>
      </div>
    </main>
  );
}
