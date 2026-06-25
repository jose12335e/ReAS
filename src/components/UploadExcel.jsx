import {
  ClipboardCheck,
  FileSpreadsheet,
  Files,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import InfoPanel from './InfoPanel.jsx';
import UploadDropzone from './UploadDropzone.jsx';

function FileTypeCard({
  icon: Icon,
  title,
  required,
  description,
  selectedText,
  tone = 'teal',
  multiple,
  disabled,
  onChange,
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
          <div className="mt-3 flex flex-wrap gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed">
            Seleccionar archivo
            <input
              className="sr-only"
              type="file"
              accept=".xlsx,.xls,.csv"
              multiple={multiple}
              disabled={disabled}
              onChange={onChange}
            />
          </label>
            <span className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600">
              Ver estructura requerida
            </span>
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
              Sube el Excel principal y, si aplica, los libros auxiliares para horarios, nómina y eventualidades.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <UploadDropzone file={primaryFile} disabled={disabled} onFile={onPrimaryFile} />
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
        />
        <FileTypeCard
          icon={Files}
          title="Horario extendido"
          tone="blue"
          description="Cruza por CODIGO y puede elegir la hoja del mes evaluado."
          selectedText={secondaryFiles.length ? `${secondaryFiles.length} archivo(s) seleccionado(s)` : ''}
          multiple
          disabled={disabled}
          onChange={(event) => onSecondaryFiles(Array.from(event.target.files ?? []))}
        />
        <FileTypeCard
          icon={ShieldCheck}
          title="Nómina"
          tone="amber"
          description="Aporta cargo, ubicación, fecha de ingreso y exclusiones."
          selectedText={payrollFile?.name}
          disabled={disabled}
          onChange={(event) => onPayrollFile(event.target.files?.[0] ?? null)}
        />
        <FileTypeCard
          icon={ClipboardCheck}
          title="Eventualidades"
          tone="violet"
          description="Confirma permisos, licencias, tardanzas y otras eventualidades."
          selectedText={eventualitiesFile?.name}
          disabled={disabled}
          onChange={(event) => onEventualitiesFile(event.target.files?.[0] ?? null)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <InfoPanel icon={FileSpreadsheet} title="Recomendaciones para carga exitosa" tone="blue">
          <ul className="grid gap-1 sm:grid-cols-3">
            <li>Usar .xlsx, .xls o .csv.</li>
            <li>Verificar códigos y fechas.</li>
            <li>Evitar celdas combinadas y encabezados vacíos.</li>
          </ul>
        </InfoPanel>
        <InfoPanel icon={LockKeyhole} title="Privacidad y seguridad" tone="teal">
          Los archivos se procesan localmente en el navegador y el cálculo pesado corre en Web Worker.
        </InfoPanel>
      </div>
    </section>
  );
}
