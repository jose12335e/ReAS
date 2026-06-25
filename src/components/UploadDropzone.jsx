import { UploadCloud } from 'lucide-react';

export default function UploadDropzone({
  file,
  disabled,
  onFile,
}) {
  return (
    <label className="group relative flex min-h-64 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50/70 px-5 py-8 text-center shadow-sm transition hover:border-teal-500 hover:bg-teal-50">
      <span className="absolute inset-x-0 top-0 h-1 bg-teal-600" />
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white text-teal-700 shadow-sm ring-1 ring-teal-100 transition group-hover:-translate-y-0.5">
        <UploadCloud className="h-8 w-8" />
      </span>
      <span className="mt-4 text-lg font-semibold text-slate-950">Arrastra o selecciona el Excel principal</span>
      <span className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
        {file ? file.name : 'Archivo requerido para leer asistencia, detectar meses, validar columnas y procesar registros.'}
      </span>
      <span className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm shadow-slate-900/10 transition group-hover:bg-slate-800">
        Seleccionar archivo
      </span>
      <span className="mt-3 text-xs font-medium text-slate-500">Formatos aceptados: .xlsx, .xls, .csv · sugerido hasta 50k filas por mes</span>
      <input
        className="sr-only"
        type="file"
        accept=".xlsx,.xls,.csv"
        disabled={disabled}
        onChange={(event) => onFile(event.target.files?.[0])}
      />
    </label>
  );
}
