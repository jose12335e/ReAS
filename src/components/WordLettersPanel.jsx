import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  FolderOpen,
  Loader2,
  Save,
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

function compactReportLabel(report) {
  if (!report) return 'Reporte sin nombre';
  return [report.month, report.dghCode || report.title, report.originalFile].filter(Boolean).join(' - ');
}

function FieldEditor({ fieldKey, value, onChange }) {
  return (
    <label className="grid gap-1.5 rounded-xl border border-slate-200 bg-white p-3">
      <span className="text-xs font-semibold uppercase text-slate-500">
        {FIELD_LABELS[fieldKey] ?? fieldKey}
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
  const fieldKeysToShow = useMemo(() => {
    const keys = placeholders.length ? placeholders : DEFAULT_FIELD_KEYS;
    return [...new Set(keys)];
  }, [placeholders]);
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
          return {
            from: detected?.replaceText ?? fallbackCandidate?.value ?? matchId,
            oldValue: detected?.oldValue ?? fallbackCandidate?.oldValue,
            to: finalData[fieldKey] ?? '',
            fieldKey,
            label: FIELD_LABELS[fieldKey] ?? fieldKey,
            source: detected?.contextBefore ?? fallbackCandidate?.value ?? matchId,
            mode: detected ? 'Numero aprobado por el usuario' : 'Reemplazo asistido manual',
            auditOldValue: oldValue,
          };
        })
        .filter(Boolean),
    [detectedMatches, finalData, replacementMappings, templateInfo?.candidates],
  );
  const activeReplacementEntries = useMemo(() => [...manualReplacementEntries], [manualReplacementEntries]);
  const replacementAuditEntries = useMemo(
    () => [
      ...placeholders.map((fieldKey) => ({
        id: `placeholder-${fieldKey}`,
        label: FIELD_LABELS[fieldKey] ?? fieldKey,
        source: `{{${fieldKey}}}`,
        mode: 'Campo de plantilla',
        oldValue: `{{${fieldKey}}}`,
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
    setOutputName(file.name.replace(/\.docx$/i, '') || 'carta-reas');
    try {
      const info = await inspectWordTemplate(file);
      const savedMapping = loadTemplateMappings(file.name);
      setTemplateInfo(info);
      setReplacementMappings(savedMapping.replacements ?? {});
      setStatus({
        tone: info.hasPlaceholders ? 'emerald' : 'amber',
        message: info.hasPlaceholders
          ? `Plantilla lista: ${info.placeholders.length} campo(s) {{ }} detectado(s).`
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
        message: 'La plantilla no tiene campos ni reemplazos seleccionados. Selecciona textos a reemplazar o agrega campos {{ }}.',
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
          message: `Carta generada: ${output.fileName}. ${output.skippedReplacements.length} reemplazo(s) no se aplicaron porque Word dividio el texto de forma insegura; revisa la vista "Viejo / Nuevo" o usa campos {{ }} para esos datos.`,
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-5">
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
                  <div className="mt-1 text-lg font-semibold text-slate-950">{detectedMatches.length}</div>
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
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <Sparkles className="h-4 w-4 text-teal-700" />
                  Valores que alimentaran la carta
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Revisa estos datos antes de generar. Si algo no esta bien, puedes corregirlo aqui sin modificar el
                  reporte original.
                </p>
              </div>
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
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {fieldKeysToShow.map((fieldKey) => (
                <FieldEditor
                  key={fieldKey}
                  fieldKey={fieldKey}
                  value={finalData[fieldKey] ?? ''}
                  onChange={handleValueChange}
                />
              ))}
            </div>
          </div>

          {replacementAuditEntries.length ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <CheckCircle2 className="h-4 w-4 text-teal-700" />
                    Valores que se reemplazaran
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Cada cambio muestra exactamente el valor viejo y el valor nuevo antes de generar la carta.
                  </p>
                </div>
                <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                  {replacementAuditEntries.length} cambio(s)
                </span>
              </div>
              <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {replacementAuditEntries.map((item) => (
                  <ReplacementAuditRow key={item.id} item={item} />
                ))}
              </div>
            </div>
          ) : null}

          {templateInfo?.candidates?.length ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <Save className="h-4 w-4 text-teal-700" />
                    Reemplazos asistidos
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    ReAS solo reemplazara numeros. Revisa el texto anterior y aprueba el campo correcto para cada valor.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {activeReplacementEntries.length} activo(s)
                </span>
              </div>
              <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                {templateInfo.candidates.map((candidate) => {
                  const suggestedValue = candidate.fieldKey ? finalData[candidate.fieldKey] : '';
                  return (
                    <div
                      key={candidate.id}
                      className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[minmax(0,1fr)_130px_130px_240px]"
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase text-slate-500">Texto antes del numero</div>
                        <div className="mt-1 text-sm font-semibold text-slate-800">
                          {candidate.contextBefore || candidate.value}
                        </div>
                        {candidate.contextAfter ? (
                          <div className="mt-1 text-xs text-slate-500">Despues: {candidate.contextAfter}</div>
                        ) : null}
                        {candidate.label ? (
                          <div className="mt-2 inline-flex rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700">
                            Sugerido: {candidate.label}
                          </div>
                        ) : null}
                      </div>
                      <div className="rounded-lg border border-rose-100 bg-white p-2">
                        <div className="text-[11px] font-semibold uppercase text-rose-600">Numero actual</div>
                        <div className="mt-1 break-words text-sm font-semibold text-rose-950">
                          {candidate.oldValue || 'vacio'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-emerald-100 bg-white p-2">
                        <div className="text-[11px] font-semibold uppercase text-emerald-700">Nuevo sugerido</div>
                        <div className="mt-1 break-words text-sm font-semibold text-emerald-950">
                          {suggestedValue || 'sin valor'}
                        </div>
                      </div>
                      <div className="grid gap-1">
                        <select
                          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                          value={replacementMappings[candidate.id] ?? ''}
                          onChange={(event) => handleReplacementChange(candidate.id, event.target.value)}
                        >
                          <option value="">No reemplazar</option>
                          {WORD_LETTER_FIELDS.map((field) => (
                            <option key={field.key} value={field.key}>
                              {field.label}
                            </option>
                          ))}
                        </select>
                        {replacementMappings[candidate.id] ? (
                          <span className="text-[11px] font-semibold text-teal-700">Aprobado para reemplazo</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
