import {
  ClipboardCheck,
  ChevronDown,
  FileSpreadsheet,
  Files,
  HelpCircle,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import UploadDropzone from './UploadDropzone.jsx';

function FileInputButton({ multiple, disabled, onChange }) {
  return (
    <label className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white transition hover:bg-slate-800">
      Seleccionar
      <input
        className="sr-only"
        type="file"
        accept=".xlsx,.xls,.csv"
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          onChange(event);
          event.target.value = '';
        }}
      />
    </label>
  );
}

function FileChip({ name, disabled, onRemove }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700">
      <span className="truncate">{name}</span>
      <button
        className="grid h-5 w-5 shrink-0 place-items-center rounded text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        title={`Eliminar ${name}`}
        disabled={disabled}
        onClick={onRemove}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function AuxiliaryFileRow({
  icon: Icon,
  title,
  description,
  selectedText,
  selectedItems,
  tone = 'slate',
  multiple,
  disabled,
  onChange,
  onClear,
  onRemoveItem,
}) {
  const tones = {
    blue: 'bg-sky-50 text-sky-700 ring-sky-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    violet: 'bg-violet-50 text-violet-700 ring-violet-100',
    slate: 'bg-slate-50 text-slate-700 ring-slate-100',
  };
  const hasSelectedItems = Boolean(selectedItems?.length);
  const hasSingleFile = Boolean(selectedText && !hasSelectedItems);

  return (
    <article className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-200/50">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ring-1 ${tones[tone]}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                Opcional
              </span>
            </div>
            <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
            {hasSelectedItems ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedItems.map((item, index) => (
                  <FileChip
                    key={`${item.name}-${index}`}
                    name={item.name}
                    disabled={disabled}
                    onRemove={() => onRemoveItem?.(index)}
                  />
                ))}
              </div>
            ) : null}
            {hasSingleFile ? (
              <div className="mt-2 flex min-w-0">
                <FileChip name={selectedText} disabled={disabled} onRemove={onClear} />
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <FileInputButton multiple={multiple} disabled={disabled} onChange={onChange} />
          {selectedItems?.length > 1 && onClear ? (
            <button
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={disabled}
              onClick={onClear}
            >
              <Trash2 className="h-4 w-4" />
              Eliminar todos
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function UploadExcel({
  primaryFile,
  secondaryFiles,
  payrollFile,
  eventualitiesFile,
  onPrimaryFile,
  onSecondaryFiles,
  onPayrollFile,
  onEventualitiesFile,
  onClearPrimaryFile,
  onRemoveSecondaryFile,
  onClearSecondaryFiles,
  onClearPayrollFile,
  onClearEventualitiesFile,
  disabled,
}) {
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase text-teal-700">Carga de archivos</div>
            <h2 className="mt-1 text-xl font-semibold tracking-normal text-slate-950">
              Prepara el procesamiento
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Carga el ponchado principal y agrega auxiliares solo cuando apliquen.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <UploadDropzone
            file={primaryFile}
            disabled={disabled}
            onFile={onPrimaryFile}
            onClear={onClearPrimaryFile}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm shadow-slate-200/50">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">Archivos auxiliares</h2>
            <p className="mt-0.5 text-xs text-slate-500">Cruces opcionales para mejorar exactitud del reporte.</p>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
            Opcional
          </span>
        </div>

        <div className="space-y-3">
          <AuxiliaryFileRow
            icon={Files}
            title="Horario extendido"
            tone="blue"
            description="Cruza por CODIGO y puede elegir la hoja del mes evaluado."
            selectedText={secondaryFiles.length ? `${secondaryFiles.length} archivo(s) seleccionado(s)` : ''}
            selectedItems={secondaryFiles}
            multiple
            disabled={disabled}
            onChange={(event) => onSecondaryFiles(Array.from(event.target.files ?? []))}
            onRemoveItem={onRemoveSecondaryFile}
            onClear={onClearSecondaryFiles}
          />
          <AuxiliaryFileRow
            icon={ShieldCheck}
            title="Nomina"
            tone="amber"
            description="Aporta cargo, ubicacion, fecha de ingreso y exclusiones."
            selectedText={payrollFile?.name}
            disabled={disabled}
            onChange={(event) => onPayrollFile(event.target.files?.[0] ?? null)}
            onClear={onClearPayrollFile}
          />
          <AuxiliaryFileRow
            icon={ClipboardCheck}
            title="Eventualidades"
            tone="violet"
            description="Confirma permisos, licencias, tardanzas y otras eventualidades."
            selectedText={eventualitiesFile?.name}
            disabled={disabled}
            onChange={(event) => onEventualitiesFile(event.target.files?.[0] ?? null)}
            onClear={onClearEventualitiesFile}
          />
        </div>
      </div>

      <details className="group rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm shadow-slate-200/50">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-800">
          <span className="inline-flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-slate-500" />
            Recomendaciones y privacidad
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
        </summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Carga exitosa
            </div>
            <ul className="space-y-1">
              <li>Usar .xlsx, .xls o .csv.</li>
              <li>Verificar codigos y fechas.</li>
              <li>Evitar celdas combinadas y encabezados vacios.</li>
            </ul>
          </div>
          <div className="rounded-lg bg-teal-50 p-3 text-teal-950">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-teal-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Privacidad
            </div>
            Los archivos se procesan localmente en el navegador y el calculo pesado corre en Web Worker.
          </div>
        </div>
      </details>
    </section>
  );
}
