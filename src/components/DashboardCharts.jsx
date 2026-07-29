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

const EVENT_COLORS = {
  ausencias: '#e11d48',
  tardanzas: '#d97706',
  salidas: '#f97316',
  ponches: '#64748b',
  vacaciones: '#0284c7',
  licencias: '#7c3aed',
};

export default function DashboardCharts({ eventDistribution, locationChart, timeline }) {
  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
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

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
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

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
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
    </>
  );
}
