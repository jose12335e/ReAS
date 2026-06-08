import { Filter, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import DataPreview from './DataPreview.jsx';

const EVENT_FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: 'ausencias', label: 'Ausencias' },
  { value: 'tardanzas', label: 'Tardanzas' },
  { value: 'salidas', label: 'Salidas tempranas' },
  { value: 'vacaciones', label: 'Vacaciones' },
  { value: 'licencias', label: 'Licencias' },
  { value: 'ponches', label: 'Ponches irregulares' },
  { value: 'correctos', label: 'Registros correctos' },
];

function hasEvent(row, eventType) {
  if (eventType === 'all') return true;
  if (eventType === 'ausencias') {
    return Number(row.ausenciasJustificadas || 0) + Number(row.ausenciasNoJustificadas || 0) > 0;
  }
  if (eventType === 'tardanzas') {
    return Number(row.tardanzasJustificadas || 0) + Number(row.tardanzasNoJustificadas || 0) > 0;
  }
  if (eventType === 'salidas') {
    return Number(row.salidasTempranasJustificadas || 0) + Number(row.salidasTempranasNoJustificadas || 0) > 0;
  }
  if (eventType === 'vacaciones') return Number(row.vacaciones || 0) > 0;
  if (eventType === 'licencias') return Number(row.licencias || 0) > 0;
  if (eventType === 'ponches') return Number(row.ponchesIrregulares || 0) > 0;
  if (eventType === 'correctos') {
    return (
      Number(row.ausenciasJustificadas || 0) +
        Number(row.ausenciasNoJustificadas || 0) +
        Number(row.tardanzasJustificadas || 0) +
        Number(row.tardanzasNoJustificadas || 0) +
        Number(row.salidasTempranasJustificadas || 0) +
        Number(row.salidasTempranasNoJustificadas || 0) +
        Number(row.ponchesIrregulares || 0) +
        Number(row.vacaciones || 0) +
        Number(row.licencias || 0) +
        Number(row.permisos || 0) ===
      0
    );
  }
  return true;
}

export default function ResultsExplorer({ result, selectedMonth }) {
  const [codeQuery, setCodeQuery] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [location, setLocation] = useState('all');
  const [eventType, setEventType] = useState('all');

  const rows = result?.summaryByEmployee ?? [];
  const locations = useMemo(
    () => Array.from(new Set(rows.map((row) => row.ubicacion).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')),
    [rows],
  );
  const filteredRows = useMemo(() => {
    const codeNeedle = codeQuery.trim().toLowerCase();
    const nameNeedle = nameQuery.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesCode = !codeNeedle || String(row.codigo || '').toLowerCase().includes(codeNeedle);
      const matchesName = !nameNeedle || String(row.nombre || '').toLowerCase().includes(nameNeedle);
      const matchesLocation = location === 'all' || row.ubicacion === location;
      return matchesCode && matchesName && matchesLocation && hasEvent(row, eventType);
    });
  }, [codeQuery, eventType, location, nameQuery, rows]);

  if (!result) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm shadow-slate-200/70">
        Procesa un archivo para consultar resultados.
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-900 text-white">
              <Filter className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-950">Resultados filtrables</h2>
              <p className="mt-1 text-sm text-slate-600">
                Consulta el resumen por empleado con filtros rápidos sin recalcular el reporte.
              </p>
            </div>
          </div>
          <span className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">
            Mes: {selectedMonth?.label ?? 'No seleccionado'}
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase text-slate-500">Código</span>
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                value={codeQuery}
                onChange={(event) => setCodeQuery(event.target.value)}
                placeholder="Buscar código"
              />
            </span>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase text-slate-500">Nombre</span>
            <input
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              value={nameQuery}
              onChange={(event) => setNameQuery(event.target.value)}
              placeholder="Buscar nombre"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase text-slate-500">Ubicación</span>
            <select
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            >
              <option value="all">Todas</option>
              {locations.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase text-slate-500">Mes</span>
            <input
              className="h-10 rounded-md border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500"
              value={selectedMonth?.label ?? 'No seleccionado'}
              readOnly
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase text-slate-500">Eventualidad</span>
            <select
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              value={eventType}
              onChange={(event) => setEventType(event.target.value)}
            >
              {EVENT_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {filteredRows.length ? (
        <DataPreview
          rows={filteredRows}
          title="Tabla principal de resultados"
          description={`${filteredRows.length.toLocaleString('es-DO')} empleado(s) encontrados con los filtros actuales.`}
        />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm font-medium text-slate-600 shadow-sm shadow-slate-200/70">
          No hay empleados que coincidan con los filtros actuales.
        </div>
      )}
    </section>
  );
}
