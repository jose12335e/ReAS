import {
  AlertTriangle,
  Clock3,
  FileSpreadsheet,
  LogOut,
  MapPin,
  TimerOff,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { parseDurationToMinutes } from '../utils/timeUtils.js';

const EVENT_COLORS = {
  ausencias: '#e11d48',
  tardanzas: '#d97706',
  salidas: '#f97316',
  ponches: '#64748b',
  vacaciones: '#0284c7',
  licencias: '#7c3aed',
};

function formatDuration(totalMinutes = 0) {
  const safeMinutes = Math.max(0, Math.round(Number(totalMinutes || 0)));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:00`;
}

function StatCard({ icon: Icon, label, value, tone = 'slate' }) {
  const tones = {
    navy: 'border-l-slate-900 bg-slate-50 text-slate-900',
    green: 'border-l-emerald-600 bg-emerald-50 text-emerald-800',
    amber: 'border-l-amber-500 bg-amber-50 text-amber-800',
    orange: 'border-l-orange-500 bg-orange-50 text-orange-800',
    red: 'border-l-rose-600 bg-rose-50 text-rose-800',
    slate: 'border-l-slate-500 bg-slate-50 text-slate-700',
  };

  return (
    <div className={`rounded-lg border border-l-4 border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70 ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-white/80 shadow-sm ring-1 ring-slate-200">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function EmptyDashboard() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm shadow-slate-200/70">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-600">
          <FileSpreadsheet className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-950">Dashboard pendiente de datos</h2>
          <p className="mt-1">
            Carga y procesa un archivo para ver las métricas, gráficos y resumen institucional.
          </p>
        </div>
      </div>
    </section>
  );
}

export default function DashboardOverview({ result }) {
  if (!result) return <EmptyDashboard />;

  const summary = result.summaryGeneral;
  const totalEmployees = result.summaryByEmployee?.length ?? 0;
  const processedRows = result.metadata?.processedRows ?? result.processedRows?.length ?? 0;
  const totalAusencias = Number(summary.ausenciasJustificadas || 0) + Number(summary.ausenciasNoJustificadas || 0);
  const totalTardanzas = Number(summary.tardanzasJustificadas || 0) + Number(summary.tardanzasNoJustificadas || 0);
  const totalSalidas =
    Number(summary.salidasTempranasJustificadas || 0) + Number(summary.salidasTempranasNoJustificadas || 0);
  const totalNoTrabajadoMin =
    parseDurationToMinutes(summary.tiempoNoTrabajadoJustificado) +
    parseDurationToMinutes(summary.tiempoNoTrabajadoNoJustificado);

  const eventDistribution = [
    { name: 'Ausencias', value: totalAusencias, key: 'ausencias' },
    { name: 'Tardanzas', value: totalTardanzas, key: 'tardanzas' },
    { name: 'Salidas tempranas', value: totalSalidas, key: 'salidas' },
    { name: 'Ponches irregulares', value: Number(summary.ponchesIrregulares || 0), key: 'ponches' },
    { name: 'Vacaciones', value: Number(summary.vacaciones || 0), key: 'vacaciones' },
    { name: 'Licencias', value: Number(summary.licencias || 0), key: 'licencias' },
  ].filter((item) => item.value > 0);

  const locationChart = (result.summaryByLocation ?? []).slice(0, 10).map((row) => ({
    ubicacion: row.ubicacion,
    Ausencias: Number(row.ausenciasJustificadas || 0) + Number(row.ausenciasNoJustificadas || 0),
    Tardanzas: Number(row.tardanzasJustificadas || 0) + Number(row.tardanzasNoJustificadas || 0),
    Salidas: Number(row.salidasTempranasJustificadas || 0) + Number(row.salidasTempranasNoJustificadas || 0),
  }));

  const timeline = Array.from(
    (result.processedRows ?? []).reduce((map, row) => {
      const date = row.FECHA || 'Sin fecha';
      if (!map.has(date)) map.set(date, { fecha: date, Ausencias: 0, Tardanzas: 0, Salidas: 0 });
      const current = map.get(date);
      const state = String(row['Estado final'] || '').toLowerCase();
      if (state.includes('ausencia')) current.Ausencias += 1;
      if (state.includes('tardanza')) current.Tardanzas += 1;
      if (state.includes('salida temprana')) current.Salidas += 1;
      return map;
    }, new Map()).values(),
  )
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
    .slice(-14);

  return (
    <section className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Empleados analizados" value={totalEmployees.toLocaleString('es-DO')} tone="navy" />
        <StatCard icon={FileSpreadsheet} label="Registros procesados" value={processedRows.toLocaleString('es-DO')} tone="green" />
        <StatCard icon={TimerOff} label="Ausencias" value={totalAusencias.toLocaleString('es-DO')} tone="red" />
        <StatCard icon={Clock3} label="Tardanzas" value={totalTardanzas.toLocaleString('es-DO')} tone="amber" />
        <StatCard icon={LogOut} label="Salidas tempranas" value={totalSalidas.toLocaleString('es-DO')} tone="orange" />
        <StatCard icon={AlertTriangle} label="Ponches irregulares" value={Number(summary.ponchesIrregulares || 0).toLocaleString('es-DO')} tone="slate" />
        <StatCard icon={MapPin} label="Ubicaciones" value={(result.summaryByLocation?.length ?? 0).toLocaleString('es-DO')} tone="navy" />
        <StatCard icon={TimerOff} label="Horas no trabajadas" value={formatDuration(totalNoTrabajadoMin)} tone="red" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
          <h2 className="text-base font-semibold text-slate-950">Distribución de eventualidades</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={eventDistribution} dataKey="value" nameKey="name" outerRadius={96} label>
                  {eventDistribution.map((entry) => (
                    <Cell key={entry.key} fill={EVENT_COLORS[entry.key]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
          <h2 className="text-base font-semibold text-slate-950">Eventualidades por ubicación</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={locationChart} margin={{ top: 8, right: 16, left: 0, bottom: 42 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="ubicacion" tick={{ fontSize: 11 }} angle={-18} textAnchor="end" height={58} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Ausencias" fill={EVENT_COLORS.ausencias} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Tardanzas" fill={EVENT_COLORS.tardanzas} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Salidas" fill={EVENT_COLORS.salidas} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
        <h2 className="text-base font-semibold text-slate-950">Tendencia por fecha</h2>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeline} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Ausencias" stroke={EVENT_COLORS.ausencias} strokeWidth={2} />
              <Line type="monotone" dataKey="Tardanzas" stroke={EVENT_COLORS.tardanzas} strokeWidth={2} />
              <Line type="monotone" dataKey="Salidas" stroke={EVENT_COLORS.salidas} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
