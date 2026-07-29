import { Trash2, UploadCloud } from 'lucide-react';

export default function UploadDropzone({
  file,
  disabled,
  onFile,
  onClear,
}) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50/70 shadow-sm transition hover:border-teal-500 hover:bg-teal-50">
      <label className="group relative flex min-h-52 cursor-pointer flex-col items-center justify-center overflow-hidden px-5 py-7 text-center">
        <span className="absolute inset-x-0 top-0 h-1 bg-teal-600" />
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-teal-700 shadow-sm ring-1 ring-teal-100 transition group-hover:-translate-y-0.5">
          <UploadCloud className="h-7 w-7" />
        </span>
        <span className="mt-4 text-lg font-semibold text-slate-950">Arrastra o selecciona el Excel principal</span>
        <span className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
          {file ? file.name : 'Archivo requerido para leer asistencia, detectar meses, validar columnas y procesar registros.'}
        </span>
        <span className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm shadow-slate-900/10 transition group-hover:bg-slate-800">
          Seleccionar archivo
        </span>
        <span className="mt-3 text-xs font-medium text-slate-500">
          Formatos aceptados: .xlsx, .xls, .csv · sugerido hasta 50k filas por mes
        </span>
        <input
          className="sr-only"
          type="file"
          accept=".xlsx,.xls,.csv"
          disabled={disabled}
          onChange={(event) => {
            onFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </label>

      {file ? (
        <div className="border-t border-teal-100 bg-white/70 px-4 py-3">
          <button
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={disabled}
            onClick={onClear}
          >
            <Trash2 className="h-4 w-4" />
            Eliminar archivo principal
          </button>
        </div>
      ) : null}
    </div>
  );
}
