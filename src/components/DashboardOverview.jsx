import {
  AlertTriangle,
  Clock3,
  FileCheck2,
  FilePlus2,
  FileSpreadsheet,
  LogOut,
  MapPin,
  Settings,
  ShieldCheck,
  TimerOff,
  Users,
} from 'lucide-react';
import { lazy, Suspense, useMemo } from 'react';
import { parseDurationToMinutes } from '../utils/timeUtils.js';
import MetricCard from './MetricCard.jsx';

const DashboardCharts = lazy(() => import('./DashboardCharts.jsx'));

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
    <div className={`rounded-2xl border border-l-4 border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70 ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/80 shadow-sm ring-1 ring-slate-200">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function EmptyDashboard({ onStartUpload, activeRulesCount = 3 }) {
  return (
    <section className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          icon={FileSpreadsheet}
          label="Estado del reporte"
          value="Pendiente"
          description="Carga el Excel principal para iniciar."
          tone="blue"
        />
        <MetricCard
          icon={Settings}
          label="Reglas disponibles"
          value={activeRulesCount}
          description="HN, HE y horario modificado."
          tone="teal"
        />
        <MetricCard
          icon={ShieldCheck}
          label="Auditoria"
          value="Lista"
          description="Se activa luego del procesamiento."
          tone="amber"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
        <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
          <div className="p-6 sm:p-8">
            <span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
              <FilePlus2 className="h-3.5 w-3.5" />
              Primer paso
            </span>
            <h2 className="mt-4 max-w-2xl text-2xl font-semibold tracking-normal text-slate-950">
              Carga un archivo para generar el dashboard institucional.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Cuando proceses la asistencia, aqui apareceran las metricas, los graficos, el ranking de casos y la
              auditoria de descuadres para revisar antes de exportar.
            </p>
            <button
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm shadow-slate-900/10 transition hover:bg-slate-800"
              type="button"
              onClick={onStartUpload}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Cargar archivos
            </button>
          </div>
          <div className="border-t border-slate-200 bg-slate-50 p-6 lg:border-l lg:border-t-0">
            <div className="text-xs font-semibold uppercase text-slate-500">Flujo recomendado</div>
            <ol className="mt-3 space-y-3 text-sm text-slate-700">
              <li className="rounded-xl bg-white p-3 ring-1 ring-slate-200">1. Cargar ponchado y auxiliares.</li>
              <li className="rounded-xl bg-white p-3 ring-1 ring-slate-200">2. Validar mes y columnas.</li>
              <li className="rounded-xl bg-white p-3 ring-1 ring-slate-200">3. Procesar y revisar auditoria.</li>
              <li className="rounded-xl bg-white p-3 ring-1 ring-slate-200">4. Exportar Excel final.</li>
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProcessedDashboardOverview({ result, activeRulesCount, hasPendingAudit }) {
  const summary = result.summaryGeneral ?? {};
  const totalEmployees = result.summaryByEmployee?.length ?? 0;
  const processedRows = result.metadata?.processedRows ?? result.processedRows?.length ?? 0;
  const totalAusencias = Number(summary.ausenciasJustificadas || 0) + Number(summary.ausenciasNoJustificadas || 0);
  const totalTardanzas = Number(summary.tardanzasJustificadas || 0) + Number(summary.tardanzasNoJustificadas || 0);
  const totalSalidas =
    Number(summary.salidasTempranasJustificadas || 0) + Number(summary.salidasTempranasNoJustificadas || 0);
  const missingPayrollSummary = result.metadata?.missingPayrollSummary;
  const totalNoTrabajadoMin =
    parseDurationToMinutes(summary.tiempoNoTrabajadoJustificado) +
    parseDurationToMinutes(summary.tiempoNoTrabajadoNoJustificado);

  const eventDistribution = useMemo(
    () =>
      [
        { name: 'Ausencias', value: totalAusencias, key: 'ausencias' },
        { name: 'Tardanzas', value: totalTardanzas, key: 'tardanzas' },
        { name: 'Salidas tempranas', value: totalSalidas, key: 'salidas' },
        { name: 'Ponches irregulares', value: Number(summary.ponchesIrregulares || 0), key: 'ponches' },
        { name: 'Vacaciones', value: Number(summary.vacaciones || 0), key: 'vacaciones' },
        { name: 'Licencias', value: Number(summary.licencias || 0), key: 'licencias' },
      ].filter((item) => item.value > 0),
    [summary, totalAusencias, totalSalidas, totalTardanzas],
  );

  const locationChart = useMemo(
    () =>
      (result.summaryByLocation ?? []).slice(0, 10).map((row) => ({
        ubicacion: row.ubicacion,
        Ausencias: Number(row.ausenciasJustificadas || 0) + Number(row.ausenciasNoJustificadas || 0),
        Tardanzas: Number(row.tardanzasJustificadas || 0) + Number(row.tardanzasNoJustificadas || 0),
        Salidas: Number(row.salidasTempranasJustificadas || 0) + Number(row.salidasTempranasNoJustificadas || 0),
      })),
    [result.summaryByLocation],
  );

  const timeline = useMemo(() => {
    const byDate = (result.processedRows ?? []).reduce((map, row) => {
      const date = row.FECHA || 'Sin fecha';
      if (!map.has(date)) map.set(date, { fecha: date, Ausencias: 0, Tardanzas: 0, Salidas: 0 });
      const current = map.get(date);
      const state = String(row['Estado final'] || '').toLowerCase();
      if (state.includes('ausencia')) current.Ausencias += 1;
      if (state.includes('tardanza')) current.Tardanzas += 1;
      if (state.includes('salida temprana')) current.Salidas += 1;
      return map;
    }, new Map());
    return Array.from(byDate.values())
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
      .slice(-14);
  }, [result.processedRows]);

  return (
    <section className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          icon={FileCheck2}
          label="Estado del reporte"
          value="Procesado"
          description={`${processedRows.toLocaleString('es-DO')} registros validados.`}
          tone="teal"
        />
        <MetricCard
          icon={ShieldCheck}
          label="Auditoria"
          value={hasPendingAudit ? 'Revisar' : 'Cuadrada'}
          description={hasPendingAudit ? 'Hay descuadres pendientes.' : 'Sin descuadres activos.'}
          tone={hasPendingAudit ? 'amber' : 'teal'}
        />
        <MetricCard
          icon={Settings}
          label="Reglas activas"
          value={activeRulesCount}
          description="Configuracion lista para exportar."
          tone="blue"
        />
      </div>

      {missingPayrollSummary?.totalEmployees ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 shadow-sm shadow-rose-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="font-semibold">Empleados del ponchado no encontrados en nomina</div>
              <p className="mt-1">
                {missingPayrollSummary.totalEmployees.toLocaleString('es-DO')} empleado(s) y{' '}
                {Number(missingPayrollSummary.totalRows || 0).toLocaleString('es-DO')} fila(s) requieren revision.
              </p>
            </div>
          </div>
        </div>
      ) : null}

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

      <Suspense
        fallback={
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-600 shadow-sm shadow-slate-200/70">
            Preparando graficos...
          </div>
        }
      >
        <DashboardCharts
          eventDistribution={eventDistribution}
          locationChart={locationChart}
          timeline={timeline}
        />
      </Suspense>
    </section>
  );
}

export default function DashboardOverview({
  result,
  onStartUpload,
  activeRulesCount = 3,
  hasPendingAudit = false,
}) {
  if (!result) return <EmptyDashboard onStartUpload={onStartUpload} activeRulesCount={activeRulesCount} />;
  return (
    <ProcessedDashboardOverview
      result={result}
      activeRulesCount={activeRulesCount}
      hasPendingAudit={hasPendingAudit}
    />
  );
}
