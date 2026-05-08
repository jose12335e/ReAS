import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarCheck,
  Clock3,
  TimerOff,
  UserCheck,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DISCIPLINARY_CATEGORY_META } from '../utils/disciplinaryRules.js';

function MetricCard({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <span className={`rounded-md p-2 ${tone}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 text-2xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

const DISCIPLINARY_KEYS = [
  { key: 'tardanzas', label: 'Tardanzas' },
  { key: 'salidasTempranas', label: 'Salidas tempranas' },
  { key: 'ausencias', label: 'Ausencias' },
];

function buildDisciplinaryCounts(employees = [], key) {
  const counts = Object.fromEntries(
    Object.keys(DISCIPLINARY_CATEGORY_META).map((category) => [category, 0]),
  );

  employees.forEach((employee) => {
    const category = employee.disciplina?.[key]?.category ?? 'none';
    counts[category] = (counts[category] ?? 0) + 1;
  });

  return counts;
}

export default function SummaryCards({ result }) {
  if (!result) return null;

  const summary = result.summaryGeneral;
  const locationChart = result.summaryByLocation.slice(0, 8).map((row) => ({
    ubicacion: row.ubicacion,
    Ausencias: row.ausenciasJustificadas + row.ausenciasNoJustificadas,
    Tardanzas: row.tardanzasJustificadas + row.tardanzasNoJustificadas,
    'Salidas tempranas': row.salidasTempranasJustificadas + row.salidasTempranasNoJustificadas,
  }));
  const disciplinaryRows = DISCIPLINARY_KEYS.map((item) => ({
    ...item,
    counts: buildDisciplinaryCounts(result.summaryByEmployee, item.key),
  }));

  return (
    <section className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          icon={CalendarCheck}
          label="Días a trabajar"
          value={summary.diasATrabajar}
          tone="bg-teal-50 text-teal-700"
        />
        <MetricCard
          icon={UserCheck}
          label="Días trabajados"
          value={summary.diasTrabajadosCompletos}
          tone="bg-emerald-50 text-emerald-700"
        />
        <MetricCard
          icon={Clock3}
          label="Horas reconocidas"
          value={summary.horasReconocidas}
          tone="bg-sky-50 text-sky-700"
        />
        <MetricCard
          icon={TimerOff}
          label="Ausentismo"
          value={`${summary.tasaAusentismo}%`}
          tone="bg-rose-50 text-rose-700"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Ponches irregulares"
          value={summary.ponchesIrregulares}
          tone="bg-amber-50 text-amber-700"
        />
        <MetricCard
          icon={BriefcaseBusiness}
          label="Ver viático"
          value={summary.verViatico}
          tone="bg-indigo-50 text-indigo-700"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">Clasificación disciplinaria</h2>
          <p className="mt-1 text-sm text-slate-600">
            Referencia institucional por acumulados mensuales no justificados.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {disciplinaryRows.map((row) => (
            <div key={row.key} className="rounded-lg border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-900">{row.label}</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {Object.values(DISCIPLINARY_CATEGORY_META).map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: category.chartColor }}
                      />
                      <span className="truncate">{category.shortLabel}</span>
                    </span>
                    <span className="font-semibold text-slate-900">{row.counts[category.id] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Eventualidades por ubicación</h2>
            <p className="mt-1 text-sm text-slate-600">Primeras ubicaciones por orden alfabético.</p>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={locationChart} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="ubicacion" tick={{ fontSize: 11 }} interval={0} angle={-18} height={60} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Ausencias" fill="#e11d48" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Tardanzas" fill="#0f766e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Salidas tempranas" fill="#d97706" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
