import { FileSpreadsheet, Files, Upload } from 'lucide-react';

export default function UploadExcel({
  primaryFile,
  secondaryFiles,
  onPrimaryFile,
  onSecondaryFiles,
  disabled,
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-slate-900">
            <FileSpreadsheet className="h-5 w-5 text-teal-700" />
            <h2 className="text-base font-semibold">Carga de archivos</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Sube el archivo principal de asistencia y el libro con empleados de horario extendido.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-teal-300 bg-teal-50/60 px-4 py-6 text-center transition hover:border-teal-500 hover:bg-teal-50">
          <Upload className="h-8 w-8 text-teal-700" />
          <span className="mt-3 text-sm font-semibold text-slate-900">Excel principal</span>
          <span className="mt-1 max-w-md text-xs text-slate-600">
            {primaryFile ? primaryFile.name : 'Selecciona un archivo .xlsx, .xls o .csv'}
          </span>
          <input
            className="sr-only"
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={disabled}
            onChange={(event) => onPrimaryFile(event.target.files?.[0])}
          />
        </label>

        <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-slate-500">
          <Files className="h-8 w-8 text-slate-600" />
          <span className="mt-3 text-sm font-semibold text-slate-900">Excel horario extendido</span>
          <span className="mt-1 max-w-sm text-xs text-slate-600">
            {secondaryFiles.length
              ? `${secondaryFiles.length} archivo(s) seleccionado(s)`
              : 'Se cruza por CODIGO y, si hay varias hojas, se elige la hoja del mes evaluado'}
          </span>
          <input
            className="sr-only"
            type="file"
            accept=".xlsx,.xls,.csv"
            multiple
            disabled={disabled}
            onChange={(event) => onSecondaryFiles(Array.from(event.target.files ?? []))}
          />
        </label>
      </div>
    </section>
  );
}
