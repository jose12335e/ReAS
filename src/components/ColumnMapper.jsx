import { SlidersHorizontal } from 'lucide-react';
import { FIELD_DEFINITIONS, validateColumnMapping } from '../utils/validationRules.js';

export default function ColumnMapper({ headers, mapping, onChange, disabled }) {
  const validation = validateColumnMapping(mapping);

  if (!headers.length) return null;

  function updateField(field, value) {
    onChange({ ...mapping, [field]: value });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-sky-50 text-sky-700">
              <SlidersHorizontal className="h-5 w-5" />
            </span>
            <h2 className="text-base font-semibold text-slate-900">Mapeo de columnas</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Ajusta los encabezados detectados antes de enviar el archivo al worker.
          </p>
        </div>
        <span
          className={`rounded-md px-3 py-1.5 text-xs font-semibold ring-1 ${
            validation.isValid
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              : 'bg-amber-50 text-amber-700 ring-amber-200'
          }`}
        >
          {validation.isValid ? 'Columnas listas' : `${validation.missing.length} requerida(s) pendiente(s)`}
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {FIELD_DEFINITIONS.map((field) => (
          <label key={field.key} className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase text-slate-500">
              {field.label}
              {field.required ? ' *' : ''}
            </span>
            <select
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
              value={mapping[field.key] ?? ''}
              disabled={disabled}
              onChange={(event) => updateField(field.key, event.target.value)}
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

      {!validation.isValid ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {validation.errors.join(' ')}
        </div>
      ) : null}
    </section>
  );
}
