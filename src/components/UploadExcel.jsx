import { FileSpreadsheet, Files, Upload } from 'lucide-react';

export default function UploadExcel({
  primaryFile,
  secondaryFiles,
  payrollFile,
  onPrimaryFile,
  onSecondaryFiles,
  onPayrollFile,
  disabled,
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-slate-900">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-50 text-teal-700">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <h2 className="text-base font-semibold">Carga de archivos</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Sube el archivo principal de asistencia, horario extendido y nómina para cruzar datos por código.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <label className="group relative flex min-h-40 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-teal-300 bg-teal-50/70 px-4 py-6 text-center shadow-sm transition hover:border-teal-500 hover:bg-teal-50">
          <span className="absolute inset-x-0 top-0 h-1 bg-teal-600" />
          <span className="grid h-12 w-12 place-items-center rounded-lg bg-white text-teal-700 shadow-sm ring-1 ring-teal-100 transition group-hover:-translate-y-0.5">
            <Upload className="h-7 w-7" />
          </span>
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

        <label className="group relative flex min-h-40 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-sky-300 bg-sky-50/50 px-4 py-6 text-center shadow-sm transition hover:border-sky-500 hover:bg-sky-50">
          <span className="absolute inset-x-0 top-0 h-1 bg-sky-600" />
          <span className="grid h-12 w-12 place-items-center rounded-lg bg-white text-sky-700 shadow-sm ring-1 ring-sky-100 transition group-hover:-translate-y-0.5">
            <Files className="h-7 w-7" />
          </span>
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

        <label className="group relative flex min-h-40 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-amber-300 bg-amber-50/70 px-4 py-6 text-center shadow-sm transition hover:border-amber-500 hover:bg-amber-50">
          <span className="absolute inset-x-0 top-0 h-1 bg-amber-500" />
          <span className="grid h-12 w-12 place-items-center rounded-lg bg-white text-amber-700 shadow-sm ring-1 ring-amber-100 transition group-hover:-translate-y-0.5">
            <FileSpreadsheet className="h-7 w-7" />
          </span>
          <span className="mt-3 text-sm font-semibold text-slate-900">Excel nómina</span>
          <span className="mt-1 max-w-sm text-xs text-slate-600">
            {payrollFile
              ? payrollFile.name
              : 'Cruza por CODIGO: cargo, ubicación y fecha de ingreso'}
          </span>
          <input
            className="sr-only"
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={disabled}
            onChange={(event) => onPayrollFile(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>
    </section>
  );
}
