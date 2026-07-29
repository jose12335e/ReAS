import {
  ClipboardCheck,
  FileSpreadsheet,
  Files,
  LockKeyhole,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import InfoPanel from './InfoPanel.jsx';
import UploadDropzone from './UploadDropzone.jsx';

function FileTypeCard({
  icon: Icon,
  title,
  required,
  description,
  selectedText,
  selectedItems,
  tone = 'teal',
  multiple,
  disabled,
  onChange,
  onClear,
  onRemoveItem,
}) {
  const tones = {
    teal: 'border-teal-200 bg-teal-50/60 text-teal-700',
    blue: 'border-sky-200 bg-sky-50/60 text-sky-700',
    amber: 'border-amber-200 bg-amber-50/70 text-amber-700',
    violet: 'border-violet-200 bg-violet-50/60 text-violet-700',
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
      <div className="flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                required ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {required ? 'Requerido' : 'Opcional'}
            </span>
          </div>
          <p className="mt-1 text-sm leading-5 text-slate-600">{selectedText || description}</p>

          {selectedItems?.length ? (
            <div className="mt-3 space-y-2">
              {selectedItems.map((item, index) => (
                <div
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  key={`${item.name}-${index}`}
                >
                  <span className="min-w-0 truncate text-xs font-semibold text-slate-700">
                    {item.name}
                  </span>
                  <button
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    title={`Eliminar ${item.name}`}
                    disabled={disabled}
                    onClick={() => onRemoveItem?.(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed">
              Seleccionar archivo
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
            <span className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600">
              Ver estructura requerida
            </span>
            {selectedText && !selectedItems?.length ? (
              <button
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={disabled}
                onClick={onClear}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            ) : null}
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
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase text-teal-700">Carga de archivos</div>
            <h2 className="mt-1 text-xl font-semibold tracking-normal text-slate-950">
              Prepara el procesamiento de asistencia
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Sube el Excel principal y, si aplica, los libros auxiliares para horarios, nomina y eventualidades.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <UploadDropzone
            file={primaryFile}
            disabled={disabled}
            onFile={onPrimaryFile}
            onClear={onClearPrimaryFile}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FileTypeCard
          icon={FileSpreadsheet}
          title="Excel principal"
          required
          tone="teal"
          description="Contiene marcas, fechas, entrada, salida y observaciones."
          selectedText={primaryFile?.name}
          disabled={disabled}
          onChange={(event) => onPrimaryFile(event.target.files?.[0])}
          onClear={onClearPrimaryFile}
        />
        <FileTypeCard
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
        <FileTypeCard
          icon={ShieldCheck}
          title="Nomina"
          tone="amber"
          description="Aporta cargo, ubicacion, fecha de ingreso y exclusiones."
          selectedText={payrollFile?.name}
          disabled={disabled}
          onChange={(event) => onPayrollFile(event.target.files?.[0] ?? null)}
          onClear={onClearPayrollFile}
        />
        <FileTypeCard
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

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <InfoPanel icon={FileSpreadsheet} title="Recomendaciones para carga exitosa" tone="blue">
          <ul className="grid gap-1 sm:grid-cols-3">
            <li>Usar .xlsx, .xls o .csv.</li>
            <li>Verificar codigos y fechas.</li>
            <li>Evitar celdas combinadas y encabezados vacios.</li>
          </ul>
        </InfoPanel>
        <InfoPanel icon={LockKeyhole} title="Privacidad y seguridad" tone="teal">
          Los archivos se procesan localmente en el navegador y el calculo pesado corre en Web Worker.
        </InfoPanel>
      </div>
    </section>
  );
}
