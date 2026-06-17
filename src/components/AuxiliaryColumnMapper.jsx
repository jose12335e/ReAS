import { SlidersHorizontal } from 'lucide-react';

function validateMapping(mapping = {}, fields = []) {
  const missing = fields.filter((field) => field.required && !mapping[field.key]);
  return {
    isValid: missing.length === 0,
    missing,
  };
}

function SheetMapper({
  title,
  description,
  preview,
  fields,
  disabled,
  onChange,
}) {
  if (!preview) return null;

  const sheets = preview.sheets ?? [];
  const selectedSheet =
    sheets.find((sheet) => sheet.sheetName === preview.selectedSheetName) ?? sheets[0] ?? {};
  const headers = selectedSheet.headers ?? preview.headers ?? [];
  const mapping = preview.mapping ?? selectedSheet.mapping ?? {};
  const validation = validateMapping(mapping, fields);

  function updateMapping(field, value) {
    onChange({
      ...preview,
      mapping: { ...mapping, [field]: value },
    });
  }

  function updateSheet(sheetName) {
    const nextSheet = sheets.find((sheet) => sheet.sheetName === sheetName) ?? selectedSheet;
    onChange({
      ...preview,
      selectedSheetName: nextSheet.sheetName,
      headers: nextSheet.headers ?? [],
      previewRows: nextSheet.previewRows ?? [],
      mapping: nextSheet.mapping ?? {},
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-700">
              <SlidersHorizontal className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
              <p className="mt-0.5 text-xs text-slate-600">{description}</p>
            </div>
          </div>
        </div>
        <span
          className={`w-fit rounded-md px-2.5 py-1 text-[11px] font-semibold ring-1 ${
            validation.isValid
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              : 'bg-amber-50 text-amber-700 ring-amber-200'
          }`}
        >
          {validation.isValid ? 'Mapeo listo' : `${validation.missing.length} requerida(s)`}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sheets.length ? (
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase text-slate-500">Hoja a usar</span>
            <select
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
              value={preview.selectedSheetName ?? ''}
              disabled={disabled}
              onChange={(event) => updateSheet(event.target.value)}
            >
              {sheets.map((sheet) => (
                <option key={sheet.sheetName} value={sheet.sheetName}>
                  {sheet.sheetName} ({sheet.rowCount?.toLocaleString?.('es-DO') ?? 0})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {fields.map((field) => (
          <label key={field.key} className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase text-slate-500">
              {field.label}
              {field.required ? ' *' : ''}
            </span>
            <select
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
              value={mapping[field.key] ?? ''}
              disabled={disabled}
              onChange={(event) => updateMapping(field.key, event.target.value)}
            >
              <option value="">No mapear</option>
              {headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {selectedSheet.previewRows?.length ? (
        <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {headers.slice(0, 6).map((header) => (
                    <th key={header} className="px-3 py-2 text-left font-semibold">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {selectedSheet.previewRows.slice(0, 3).map((row, index) => (
                  <tr key={`${selectedSheet.sheetName}-${index}`}>
                    {headers.slice(0, 6).map((header) => (
                      <td key={header} className="max-w-48 truncate px-3 py-2">
                        {String(row?.[header] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AuxiliaryColumnMapper({
  previews,
  fields,
  disabled,
  onChange,
}) {
  const extended = previews.extended ?? [];
  const payroll = previews.payroll;
  const eventualities = previews.eventualities;

  if (!extended.length && !payroll && !eventualities) return null;

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-50 text-indigo-700">
            <SlidersHorizontal className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-950">Mapeo de archivos auxiliares</h2>
            <p className="mt-1 text-sm text-slate-600">
              Confirma qué columna corresponde a cada campo antes de procesar.
            </p>
          </div>
        </div>
      </div>

      {extended.map((preview, index) => (
        <SheetMapper
          key={preview.id ?? `${preview.fileName}-${index}`}
          title={`Horario extendido - ${preview.fileName}`}
          description="Se cruza por código de empleado."
          preview={preview}
          fields={fields.extended}
          disabled={disabled}
          onChange={(nextPreview) => {
            const next = [...extended];
            next[index] = nextPreview;
            onChange({ ...previews, extended: next });
          }}
        />
      ))}

      <SheetMapper
        title={`Nómina - ${payroll?.fileName ?? ''}`}
        description="Datos de empleado, cargo, ubicación, fecha de ingreso y posición."
        preview={payroll}
        fields={fields.payroll}
        disabled={disabled}
        onChange={(nextPreview) => onChange({ ...previews, payroll: nextPreview })}
      />

      <SheetMapper
        title={`Eventualidades - ${eventualities?.fileName ?? ''}`}
        description="Cruce por código, fecha, tipo, estado, comentario y tiempo."
        preview={eventualities}
        fields={fields.eventualities}
        disabled={disabled}
        onChange={(nextPreview) => onChange({ ...previews, eventualities: nextPreview })}
      />
    </section>
  );
}
