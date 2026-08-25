import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  FolderOpen,
  ListChecks,
  Loader2,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  WORD_LETTER_FIELDS,
  buildLetterData,
  buildLetterScopeOptions,
  downloadBlob,
  generateWordLetter,
  inspectWordTemplate,
  loadTemplateMappings,
  saveTemplateMappings,
} from '../utils/wordLetterBuilder.js';

const DEFAULT_FIELD_KEYS = [
  'codigo_dgh',
  'mes_evaluado',
  'mes_evaluado_nombre',
  'fecha_expedicion',
  'area',
  'empleados_analizados',
  'dias_a_trabajar',
  'dias_trabajados',
  'porcentaje_cumplimiento_dias',
  'horas_a_trabajar',
  'horas_trabajadas',
  'porcentaje_cumplimiento_horas',
  'tasa_ausentismo',
  'ausencias',
  'tardanzas',
  'salidas_tempranas',
  'tiempo_justificado',
  'tiempo_no_justificado',
  'tiempo_general_eventualidades',
  'estado_auditoria',
  'generado_por',
  'fecha_generacion',
];

const FIELD_LABELS = Object.fromEntries(WORD_LETTER_FIELDS.map((field) => [field.key, field.label]));
const MANUAL_FIELD_KEY = '__manual';
const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

function humanizeFieldKey(fieldKey = '') {
  return FIELD_LABELS[fieldKey] ?? String(fieldKey).replace(/[_.-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function compactReportLabel(report) {
  if (!report) return 'Reporte sin nombre';
  return [report.month, report.dghCode || report.title, report.originalFile].filter(Boolean).join(' - ');
}

function FieldEditor({ fieldKey, value, onChange }) {
  return (
    <label className="grid gap-1.5 rounded-xl border border-slate-200 bg-white p-3">
      <span className="text-xs font-semibold uppercase text-slate-500">
        {humanizeFieldKey(fieldKey)}
      </span>
      <input
        className="h-10 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-100"
        type="text"
        value={value ?? ''}
        onChange={(event) => onChange(fieldKey, event.target.value)}
      />
    </label>
  );
}

function StatusMessage({ tone = 'slate', children }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
    sky: 'border-sky-200 bg-sky-50 text-sky-900',
  };
  return <div className={`rounded-xl border p-3 text-sm font-medium ${tones[tone]}`}>{children}</div>;
}

function ReplacementAuditRow({ item }) {
  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1fr)_minmax(120px,0.45fr)_minmax(120px,0.45fr)]">
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase text-slate-500">{item.label}</div>
        <div className="mt-1 truncate text-sm font-semibold text-slate-950">{item.source}</div>
        <div className="mt-1 text-xs text-slate-500">{item.mode}</div>
      </div>
      <div className="rounded-lg border border-rose-100 bg-rose-50 p-2">
        <div className="text-[11px] font-semibold uppercase text-rose-600">Viejo</div>
        <div className="mt-1 break-words text-sm font-semibold text-rose-950">{item.oldValue || 'vacio'}</div>
      </div>
      <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-2">
        <div className="text-[11px] font-semibold uppercase text-emerald-700">Nuevo</div>
        <div className="mt-1 break-words text-sm font-semibold text-emerald-950">{item.newValue || 'vacio'}</div>
      </div>
    </div>
  );
}

export default function WordLettersPanel({
  result,
  dghCode,
  activeUser,
  localDatabaseState,
  onLoadLocalReport,
}) {
  const [sourceMode, setSourceMode] = useState('current');
  const [localReportId, setLocalReportId] = useState(localDatabaseState?.selectedReportId ?? '');
  const [localResult, setLocalResult] = useState(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [templateFile, setTemplateFile] = useState(null);
  const [templateInfo, setTemplateInfo] = useState(null);
  const [scopeId, setScopeId] = useState('general');
  const [valueOverrides, setValueOverrides] = useState({});
  const [replacementMappings, setReplacementMappings] = useState({});
  const [manualReplacementValues, setManualReplacementValues] = useState({});
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [outputName, setOutputName] = useState('carta-reas');
  const [status, setStatus] = useState(null);
  const [generating, setGenerating] = useState(false);

  const sourceResult = sourceMode === 'local' ? localResult : result;
  const scopeOptions = useMemo(() => buildLetterScopeOptions(sourceResult), [sourceResult]);
  const selectedScope = scopeOptions.find((scope) => scope.id === scopeId) ?? scopeOptions[0] ?? null;
  const baseData = useMemo(
    () => (sourceResult ? buildLetterData(sourceResult, selectedScope, { dghCode, generatedBy: activeUser }) : {}),
    [activeUser, dghCode, selectedScope, sourceResult],
  );
  const finalData = useMemo(() => ({ ...baseData, ...valueOverrides }), [baseData, valueOverrides]);
  const placeholders = useMemo(() => templateInfo?.placeholders ?? [], [templateInfo]);
  const detectedMatches = useMemo(() => templateInfo?.detectedMatches ?? [], [templateInfo]);
  const previewBlocks = useMemo(() => templateInfo?.previewBlocks ?? [], [templateInfo]);
  const selectedMatch = useMemo(
    () => detectedMatches.find((match) => match.id === selectedMatchId) ?? detectedMatches[0] ?? null,
    [detectedMatches, selectedMatchId],
  );
  const fieldKeysToShow = useMemo(() => {
    const keys = placeholders.length ? placeholders : DEFAULT_FIELD_KEYS;
    return [...new Set(keys)];
  }, [placeholders]);
  const numericReplacementFields = useMemo(
    () => WORD_LETTER_FIELDS.filter((field) => /\d/.test(String(finalData[field.key] ?? ''))),
    [finalData],
  );
  const unknownPlaceholders = placeholders.filter((placeholder) => !(placeholder in baseData));
  const manualReplacementEntries = useMemo(
    () =>
      Object.entries(replacementMappings)
        .filter(([, fieldKey]) => fieldKey)
        .map(([matchId, fieldKey]) => {
          const detected = detectedMatches.find((match) => match.id === matchId);
          const fallbackCandidate = templateInfo?.candidates?.find((candidate) => candidate.id === matchId);
          if (!detected && !fallbackCandidate) return null;
          const oldValue = detected?.oldValue ?? fallbackCandidate?.oldValue ?? fallbackCandidate?.value ?? matchId;
          const manualValue = manualReplacementValues[matchId];
          const nextValue = fieldKey === MANUAL_FIELD_KEY ? manualValue : manualValue || finalData[fieldKey] || '';
          if (!nextValue) return null;
          return {
            from: detected?.replaceText ?? fallbackCandidate?.value ?? matchId,
            oldValue: detected?.oldValue ?? fallbackCandidate?.oldValue,
            to: nextValue,
            fieldKey,
            label: fieldKey === MANUAL_FIELD_KEY ? 'Valor manual' : humanizeFieldKey(fieldKey),
            source: detected?.contextBefore ?? fallbackCandidate?.value ?? matchId,
            mode: detected ? 'Numero aprobado por el usuario' : 'Reemplazo asistido manual',
            auditOldValue: oldValue,
          };
        })
        .filter(Boolean),
    [detectedMatches, finalData, manualReplacementValues, replacementMappings, templateInfo?.candidates],
  );
  const activeReplacementEntries = useMemo(() => [...manualReplacementEntries], [manualReplacementEntries]);
  const replacementAuditEntries = useMemo(
    () => [
      ...placeholders.map((fieldKey) => ({
        id: `placeholder-${fieldKey}`,
        label: humanizeFieldKey(fieldKey),
        source: `Campo automatico: ${humanizeFieldKey(fieldKey)}`,
        mode: 'Campo automatico de la carta',
        oldValue: 'Valor escrito en la plantilla',
        newValue: finalData[fieldKey] ?? '',
      })),
      ...activeReplacementEntries.map((entry, index) => ({
        id: `replacement-${index}-${entry.fieldKey}`,
        label: entry.label,
        source: entry.source,
        mode: entry.mode,
        oldValue: entry.auditOldValue ?? entry.oldValue ?? entry.from,
        newValue: entry.to,
      })),
    ],
    [activeReplacementEntries, finalData, placeholders],
  );
  const selectedMatchIndex = selectedMatch
    ? detectedMatches.findIndex((match) => match.id === selectedMatch.id)
    : -1;
  const approvedNumberCount = detectedMatches.filter((match) => replacementMappings[match.id]).length;
  const pendingNumberCount = Math.max(0, detectedMatches.length - approvedNumberCount);
  const selectedReplacementField = selectedMatch
    ? replacementMappings[selectedMatch.id] ?? selectedMatch.fieldKey ?? ''
    : '';
  const selectedSuggestedValue =
    selectedMatch && selectedReplacementField && selectedReplacementField !== MANUAL_FIELD_KEY
      ? finalData[selectedReplacementField] ?? ''
      : '';
  const selectedFinalValue = selectedMatch
    ? manualReplacementValues[selectedMatch.id] ?? selectedSuggestedValue ?? ''
    : '';

  useEffect(() => {
    if (localDatabaseState?.selectedReportId) setLocalReportId(localDatabaseState.selectedReportId);
  }, [localDatabaseState?.selectedReportId]);

  useEffect(() => {
    if (scopeOptions.length && !scopeOptions.some((scope) => scope.id === scopeId)) {
      setScopeId(scopeOptions[0].id);
    }
  }, [scopeId, scopeOptions]);

  async function handleTemplateFile(file) {
    if (!file) return;
    setStatus(null);
    setTemplateFile(file);
    setTemplateInfo(null);
    setValueOverrides({});
    setReplacementMappings({});
    setManualReplacementValues({});
    setSelectedMatchId('');
    setOutputName(file.name.replace(/\.docx$/i, '') || 'carta-reas');
    try {
      const info = await inspectWordTemplate(file);
      const savedMapping = loadTemplateMappings(file.name);
      setTemplateInfo(info);
      setReplacementMappings(savedMapping.replacements ?? {});
      setSelectedMatchId(info.detectedMatches?.[0]?.id ?? '');
      setStatus({
        tone: info.hasPlaceholders ? 'emerald' : 'amber',
        message: info.hasPlaceholders
          ? `Plantilla lista: ${info.placeholders.length} campo(s) automatico(s) detectado(s).`
          : `Plantilla en modo asistido: ${info.detectedMatches.length} numero(s) detectado(s). Aprueba solo los que correspondan.`,
      });
    } catch (error) {
      setStatus({ tone: 'rose', message: error?.message || 'No se pudo leer la plantilla Word.' });
    }
  }

  async function handleLoadLocalReport() {
    if (!localReportId || !onLoadLocalReport) return;
    setLocalLoading(true);
    setStatus(null);
    try {
      const record = await onLoadLocalReport(localReportId);
      setLocalResult(record.result);
      setSourceMode('local');
      setStatus({
        tone: 'emerald',
        message: `Reporte cargado para carta: ${record.entry?.month ?? 'sin mes'}.`,
      });
    } catch (error) {
      setStatus({ tone: 'rose', message: error?.message || 'No se pudo cargar el reporte de la base local.' });
    } finally {
      setLocalLoading(false);
    }
  }

  function handleValueChange(fieldKey, value) {
    setValueOverrides((current) => ({ ...current, [fieldKey]: value }));
  }

  function handleReplacementChange(candidateValue, fieldKey) {
    setReplacementMappings((current) => ({
      ...current,
      [candidateValue]: fieldKey,
    }));
  }

  function handleManualReplacementValue(matchId, value) {
    setManualReplacementValues((current) => ({ ...current, [matchId]: value }));
  }

  function handleApproveSelectedMatch(fieldKey = null) {
    if (!selectedMatch) return;
    const selectedField = replacementMappings[selectedMatch.id];
    const nextField = fieldKey ?? selectedField ?? selectedMatch.fieldKey ?? MANUAL_FIELD_KEY;
    setReplacementMappings((current) => ({ ...current, [selectedMatch.id]: nextField }));
    if (!manualReplacementValues[selectedMatch.id]) {
      const suggested = nextField === MANUAL_FIELD_KEY ? selectedMatch.oldValue : finalData[nextField];
      if (suggested) handleManualReplacementValue(selectedMatch.id, suggested);
    }
  }

  function handleSelectAdjacentMatch(direction) {
    if (!detectedMatches.length) return;
    const currentIndex = selectedMatchIndex >= 0 ? selectedMatchIndex : 0;
    const nextIndex = Math.min(
      detectedMatches.length - 1,
      Math.max(0, currentIndex + direction),
    );
    setSelectedMatchId(detectedMatches[nextIndex]?.id ?? '');
  }

  function handleFieldSelection(matchId, fieldKey) {
    handleReplacementChange(matchId, fieldKey);
    if (fieldKey === MANUAL_FIELD_KEY && !manualReplacementValues[matchId]) {
      const match = detectedMatches.find((item) => item.id === matchId);
      handleManualReplacementValue(matchId, match?.oldValue ?? '');
    }
  }

  function handleClearSelectedMatch() {
    if (!selectedMatch) return;
    setReplacementMappings((current) => {
      const next = { ...current };
      delete next[selectedMatch.id];
      return next;
    });
  }

  function renderPreviewText(text, keyPrefix) {
    const rawText = String(text ?? '');
    if (!/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/.test(rawText)) return <span>{rawText}</span>;
    const nodes = [];
    let cursor = 0;
    rawText.replace(PLACEHOLDER_PATTERN, (match, fieldKey, offset) => {
      if (offset > cursor) {
        nodes.push(<span key={`${keyPrefix}-text-${cursor}`}>{rawText.slice(cursor, offset)}</span>);
      }
      const value = finalData[fieldKey];
      nodes.push(
        <span
          key={`${keyPrefix}-field-${offset}`}
          className="mx-0.5 inline-flex rounded-md bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-800 ring-1 ring-emerald-200"
          title={humanizeFieldKey(fieldKey)}
        >
          {value || 'pendiente'}
        </span>,
      );
      cursor = offset + match.length;
      return match;
    });
    if (cursor < rawText.length) {
      nodes.push(<span key={`${keyPrefix}-text-end`}>{rawText.slice(cursor)}</span>);
    }
    return nodes;
  }

  async function handleGenerateWord() {
    if (!sourceResult) {
      setStatus({ tone: 'rose', message: 'Primero procesa o carga un reporte para alimentar la carta.' });
      return;
    }
    if (!templateFile) {
      setStatus({ tone: 'rose', message: 'Carga una plantilla Word .docx antes de generar.' });
      return;
    }
    if (!placeholders.length && !activeReplacementEntries.length) {
      setStatus({
        tone: 'amber',
        message: 'La plantilla no tiene campos ni reemplazos seleccionados. Selecciona los numeros que quieres actualizar o usa campos automaticos en la carta.',
      });
      return;
    }
    setGenerating(true);
    setStatus({ tone: 'sky', message: 'Generando carta Word...' });
    try {
      const output = await generateWordLetter({
        templateFile,
        data: finalData,
        replacements: activeReplacementEntries,
        outputName,
      });
      downloadBlob(output.blob, output.fileName);
      saveTemplateMappings(templateFile.name, { replacements: replacementMappings });
      if (output.skippedReplacements?.length) {
        setStatus({
          tone: 'amber',
          message: `Carta generada: ${output.fileName}. ${output.skippedReplacements.length} reemplazo(s) no se aplicaron porque Word dividio ese texto internamente; revisa el cambio o usa un campo automatico para esos datos.`,
        });
      } else {
        setStatus({ tone: 'emerald', message: `Carta generada correctamente: ${output.fileName}` });
      }
    } catch (error) {
      setStatus({
        tone: 'rose',
        message:
          error?.message ||
          'No se pudo generar la carta. Revisa que la plantilla sea .docx y que los campos esten bien escritos.',
      });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-950">Cartas institucionales</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Carga una carta Word como modelo y alimentala con resultados consolidados del reporte actual o de la
                base local. Puedes revisar y corregir los valores antes de descargar.
              </p>
            </div>
          </div>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            type="button"
            disabled={generating || !templateFile || !sourceResult}
            onClick={handleGenerateWord}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Generar carta Word
          </button>
        </div>

        {status ? (
          <div className="mt-4">
            <StatusMessage tone={status.tone}>{status.message}</StatusMessage>
          </div>
        ) : null}
      </div>

      <div className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <UploadCloud className="h-4 w-4 text-teal-700" />
              Plantilla Word
            </div>
            <label className="mt-4 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-teal-300 bg-teal-50/40 p-5 text-center transition hover:bg-teal-50">
              <UploadCloud className="h-8 w-8 text-teal-700" />
              <span className="mt-3 text-sm font-semibold text-slate-950">
                {templateFile ? templateFile.name : 'Selecciona una carta .docx'}
              </span>
              <span className="mt-1 text-xs text-slate-500">Se conserva el formato original de Word.</span>
              <input
                className="sr-only"
                type="file"
                accept=".docx"
                onChange={(event) => handleTemplateFile(event.target.files?.[0])}
              />
            </label>
            {templateInfo ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase text-slate-500">Campos</div>
                  <div className="mt-1 text-lg font-semibold text-slate-950">{placeholders.length}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase text-slate-500">Numeros detectados</div>
                  <div className="mt-1 text-lg font-semibold text-slate-950">{templateInfo.candidates.length}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase text-slate-500">Pendientes de aprobar</div>
                  <div className="mt-1 text-lg font-semibold text-slate-950">{pendingNumberCount}</div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <FolderOpen className="h-4 w-4 text-teal-700" />
              Fuente y alcance
            </div>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase text-slate-500">Fuente de datos</span>
                <select
                  className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  value={sourceMode}
                  onChange={(event) => setSourceMode(event.target.value)}
                >
                  <option value="current">Reporte actual procesado</option>
                  <option value="local">Reporte guardado en base local</option>
                </select>
              </label>

              {sourceMode === 'local' ? (
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                  <select
                    className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    value={localReportId}
                    disabled={!localDatabaseState?.connected || !localDatabaseState?.reports?.length || localLoading}
                    onChange={(event) => setLocalReportId(event.target.value)}
                  >
                    {localDatabaseState?.reports?.length ? (
                      localDatabaseState.reports.map((report) => (
                        <option key={report.id} value={report.id}>
                          {compactReportLabel(report)}
                        </option>
                      ))
                    ) : (
                      <option value="">Sin reportes guardados</option>
                    )}
                  </select>
                  <button
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 text-sm font-semibold text-sky-800 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    disabled={!localReportId || localLoading || !onLoadLocalReport}
                    onClick={handleLoadLocalReport}
                  >
                    {localLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
                    Usar reporte
                  </button>
                </div>
              ) : null}

              <label className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase text-slate-500">Alcance de la carta</span>
                <select
                  className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  value={selectedScope?.id ?? ''}
                  disabled={!sourceResult || !scopeOptions.length}
                  onChange={(event) => setScopeId(event.target.value)}
                >
                  {scopeOptions.length ? (
                    scopeOptions.map((scope) => (
                      <option key={scope.id} value={scope.id}>
                        {scope.label}
                      </option>
                    ))
                  ) : (
                    <option value="">Procesa o carga un reporte primero</option>
                  )}
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase text-slate-500">Nombre de salida</span>
                <input
                  className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  type="text"
                  value={outputName}
                  onChange={(event) => setOutputName(event.target.value)}
                />
              </label>
            </div>

            {!sourceResult ? (
              <div className="mt-4">
                <StatusMessage tone="amber">
                  No hay reporte disponible para alimentar la carta. Procesa uno o carga uno desde la base local.
                </StatusMessage>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-5">
          {templateInfo ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <FileText className="h-4 w-4 text-teal-700" />
                    Carta editable
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Trabaja directo sobre la carta: amarillo pendiente, azul seleccionado y verde aprobado.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 ring-1 ring-emerald-100">
                    {approvedNumberCount} aprobado(s)
                  </span>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700 ring-1 ring-amber-100">
                    {pendingNumberCount} pendiente(s)
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="h-[72vh] min-h-[640px] overflow-y-auto rounded-lg border border-slate-200 bg-slate-100 p-4">
                  <div className="mx-auto min-h-full max-w-4xl rounded-sm bg-white px-10 py-12 text-base leading-9 text-slate-900 shadow-sm sm:px-14">
                    {previewBlocks.length ? (
                      previewBlocks.map((block) => (
                        <p key={block.id} className="mb-4 whitespace-pre-wrap">
                          {block.parts.map((part, index) =>
                            part.type === 'number' && part.matchId ? (
                              <button
                                key={`${block.id}-${index}`}
                                type="button"
                                className={`mx-0.5 rounded-md px-2 py-1 font-semibold transition ${
                                  replacementMappings[part.matchId]
                                    ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300'
                                    : selectedMatchId === part.matchId
                                      ? 'bg-sky-100 text-sky-900 ring-2 ring-sky-300'
                                      : 'bg-amber-100 text-amber-900 ring-1 ring-amber-200 hover:bg-amber-200'
                                }`}
                                onClick={() => setSelectedMatchId(part.matchId)}
                              >
                                {part.text}
                              </button>
                            ) : (
                              <span key={`${block.id}-${index}`}>
                                {renderPreviewText(part.text, `${block.id}-${index}`)}
                              </span>
                            ),
                          )}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">Carga una plantilla para ver la carta aqui.</p>
                    )}
                  </div>
                </div>

                <div className="self-start rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70 xl:sticky xl:top-5">
                  {selectedMatch ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase text-slate-500">Numero seleccionado</div>
                          <div className="mt-1 text-sm font-semibold text-slate-950">
                            {selectedMatchIndex + 1} de {detectedMatches.length}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            type="button"
                            disabled={selectedMatchIndex <= 0}
                            onClick={() => handleSelectAdjacentMatch(-1)}
                            title="Numero anterior"
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </button>
                          <button
                            className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            type="button"
                            disabled={selectedMatchIndex >= detectedMatches.length - 1}
                            onClick={() => handleSelectAdjacentMatch(1)}
                            title="Numero siguiente"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs font-semibold uppercase text-slate-500">Texto antes del numero</div>
                        <div className="mt-1 max-h-32 overflow-y-auto text-sm font-semibold leading-6 text-slate-900">
                          {selectedMatch.contextBefore || 'Sin texto previo'}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-rose-100 bg-rose-50 p-3">
                          <div className="text-[11px] font-semibold uppercase text-rose-600">Actual</div>
                          <div className="mt-1 break-words text-xl font-semibold text-rose-950">
                            {selectedMatch.oldValue}
                          </div>
                        </div>
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                          <div className="text-[11px] font-semibold uppercase text-emerald-700">Nuevo</div>
                          <div className="mt-1 break-words text-xl font-semibold text-emerald-950">
                            {selectedFinalValue || 'sin valor'}
                          </div>
                        </div>
                      </div>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-semibold uppercase text-slate-500">Concepto / campo</span>
                        <select
                          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                          value={selectedReplacementField}
                          onChange={(event) => handleFieldSelection(selectedMatch.id, event.target.value)}
                        >
                          <option value="">No reemplazar</option>
                          <option value={MANUAL_FIELD_KEY}>Valor manual</option>
                          {numericReplacementFields.map((field) => (
                            <option key={field.key} value={field.key}>
                              {field.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-semibold uppercase text-slate-500">Valor final</span>
                        <input
                          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                          type="text"
                          value={selectedFinalValue}
                          onChange={(event) => handleManualReplacementValue(selectedMatch.id, event.target.value)}
                        />
                      </label>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                        <button
                          className="inline-flex h-10 items-center justify-center rounded-lg bg-teal-700 px-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                          type="button"
                          disabled={
                            !replacementMappings[selectedMatch.id] &&
                            !selectedMatch.fieldKey &&
                            !manualReplacementValues[selectedMatch.id]
                          }
                          onClick={() => handleApproveSelectedMatch()}
                        >
                          Aprobar cambio
                        </button>
                        <button
                          className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                          type="button"
                          onClick={handleClearSelectedMatch}
                        >
                          Dejar igual
                        </button>
                      </div>
                      {activeReplacementEntries.length ? (
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                          {activeReplacementEntries.length} cambio(s) listos para generar.
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
                      Selecciona un numero resaltado en la carta para revisar el cambio.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <details className="group rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
            <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <Sparkles className="h-4 w-4 text-teal-700" />
                  Ajustes avanzados de valores
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Abre esta parte solo si necesitas corregir un dato base antes de aprobar los numeros de la carta.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {unknownPlaceholders.length ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {unknownPlaceholders.length} campo(s) no conocidos
                </span>
                ) : placeholders.length ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Campos listos
                </span>
                ) : null}
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {fieldKeysToShow.length} dato(s)
                </span>
              </div>
            </summary>

            <div className="grid gap-3 border-t border-slate-100 p-4 md:grid-cols-2">
              {fieldKeysToShow.map((fieldKey) => (
                <FieldEditor
                  key={fieldKey}
                  fieldKey={fieldKey}
                  value={finalData[fieldKey] ?? ''}
                  onChange={handleValueChange}
                />
              ))}
            </div>
          </details>

          {replacementAuditEntries.length ? (
            <details className="group rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
              <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <ListChecks className="h-4 w-4 text-teal-700" />
                    Cambios aprobados
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Verifica el detalle viejo/nuevo si quieres hacer una revision final.
                  </p>
                </div>
                <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                  {replacementAuditEntries.length} cambio(s)
                </span>
              </summary>
              <div className="max-h-[420px] space-y-2 overflow-y-auto border-t border-slate-100 p-4">
                {replacementAuditEntries.map((item) => (
                  <ReplacementAuditRow key={item.id} item={item} />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </section>
  );
}
