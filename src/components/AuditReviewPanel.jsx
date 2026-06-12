import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Fingerprint,
  MapPin,
  PencilLine,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatMinutes, parseDurationToMinutes } from '../utils/auditRules.js';

function AuditBadge({ hasDiscrepancies }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${
        hasDiscrepancies
          ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
          : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
      }`}
    >
      {hasDiscrepancies ? <ShieldAlert className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
      {hasDiscrepancies ? 'Requiere revision' : 'Cuadrado'}
    </span>
  );
}

function durationFromHours(value) {
  const minutes = Math.round(Number(value || 0) * 60);
  return formatMinutes(minutes);
}

function defaultAdjustmentTime(employee, detail) {
  const detailDifference = Number(detail?.diferenciaMin || 0);
  const employeeDifference = Number(employee?.diferenciaMin || 0);
  return formatMinutes(Math.abs(detailDifference || employeeDifference));
}

function detailKey(employee, detail) {
  return [employee.codigo, employee.ubicacion, detail?.fila, detail?.fecha, detail?.diferencia].join('::');
}

function fieldValue(detail, field, fallback = 'vacio') {
  const value = detail?.[field];
  return value == null || value === '' ? fallback : value;
}

function MetricPill({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
    navy: 'border-slate-800 bg-slate-900 text-white',
  };

  return (
    <div className={`rounded-lg border px-3 py-2 ${tones[tone]}`}>
      <div className="text-[11px] font-semibold uppercase opacity-75">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function AdjustmentButton({ children, disabled, onClick, tone = 'teal' }) {
  const tones = {
    teal: 'bg-teal-700 hover:bg-teal-800',
    navy: 'bg-slate-900 hover:bg-slate-800',
    amber: 'bg-amber-600 hover:bg-amber-700',
  };

  return (
    <button
      className={`rounded-md px-3 py-2 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-300 ${tones[tone]}`}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function EventualityReconciliation({ reconciliation, disabled, onResolve }) {
  const [showAll, setShowAll] = useState(false);
  if (!reconciliation?.enabled) return null;

  const pending = reconciliation.pendingItems ?? [];
  const visibleItems = showAll ? pending : pending.slice(0, 20);
  const statusStyles = {
    tipo_no_reconocido: 'border-rose-300 bg-rose-50 text-rose-800',
    tipo_diferente: 'border-rose-300 bg-rose-50 text-rose-800',
    solo_eventualidades: 'border-violet-300 bg-violet-50 text-violet-900',
    solo_asistencia: 'border-amber-300 bg-amber-50 text-amber-900',
    requiere_confirmacion: 'border-orange-300 bg-orange-50 text-orange-900',
  };

  return (
    <div className="mt-4 rounded-xl border-2 border-violet-200 bg-violet-50/40 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-700 text-white">
              <ArrowRightLeft className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-950">
                Prioridad 1: conciliación de eventualidades
              </h3>
              <p className="mt-0.5 text-xs text-slate-600">
                Compara código, fecha y tipo entre asistencia y el Excel de eventualidades.
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <MetricPill label="Confirmadas" value={reconciliation.stats?.confirmed ?? 0} tone="green" />
          <MetricPill label="Pendientes" value={reconciliation.stats?.pending ?? 0} tone="rose" />
          <MetricPill label="Tipo diferente" value={reconciliation.stats?.differentType ?? 0} tone="amber" />
          <MetricPill label="Con -1" value={reconciliation.stats?.pendingTime ?? 0} tone="amber" />
        </div>
      </div>

      {pending.length ? (
        <>
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-violet-200 bg-white p-3 text-sm text-violet-950">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" />
            <span>
              Estos casos se presentan primero porque una fuente no confirma a la otra. El Excel de eventualidades
              tiene prioridad para clasificar; revisa la diferencia y luego valida el cuadre de horas.
            </span>
          </div>
          <div className="mt-3 grid gap-3">
            {visibleItems.map((item) => (
              <article
                key={item.id}
                className={`rounded-lg border p-3 ${statusStyles[item.status] ?? 'border-slate-200 bg-white text-slate-800'}`}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{item.nombre || 'Empleado sin nombre'}</span>
                      <span className="rounded bg-white/80 px-2 py-0.5 text-xs font-semibold ring-1 ring-black/10">
                        {item.codigo}
                      </span>
                      <span className="rounded bg-white/80 px-2 py-0.5 text-xs font-semibold ring-1 ring-black/10">
                        {item.fecha}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium">{item.reason}</p>
                    <div className="mt-2 grid gap-x-5 gap-y-1 text-xs sm:grid-cols-2 xl:grid-cols-4">
                      <span><b>En eventualidades:</b> {item.tipoExternoLabel}</span>
                      <span><b>En asistencia:</b> {item.tiposAsistenciaLabel}</span>
                      <span><b>Cantidad días:</b> {item.cantidadDias ?? 'vacío'}</span>
                      <span><b>Cantidad horas:</b> {item.cantidadHoras ?? 'vacío'}</span>
                      <span><b>Ubicación:</b> {item.ubicacion || 'Sin ubicación'}</span>
                      <span><b>Fila asistencia:</b> {item.filaAsistencia || 'No encontrada'}</span>
                      <span><b>Hoja eventualidades:</b> {item.hoja || 'No disponible'}</span>
                      <span><b>Fila eventualidades:</b> {item.filaEventualidades || 'No encontrada'}</span>
                    </div>
                  </div>
                  <button
                    className="shrink-0 rounded-md bg-violet-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      onResolve(
                        item,
                        item.status === 'requiere_confirmacion'
                          ? 'Tiempo -1 confirmado y revisado por el usuario'
                          : 'Diferencia de eventualidad revisada por el usuario',
                      )
                    }
                  >
                    {item.status === 'requiere_confirmacion' ? 'Confirmar y continuar' : 'Marcar revisado'}
                  </button>
                </div>
              </article>
            ))}
          </div>
          {pending.length > 20 ? (
            <button
              className="mt-3 text-sm font-semibold text-violet-700 hover:text-violet-900"
              type="button"
              onClick={() => setShowAll((current) => !current)}
            >
              {showAll ? 'Mostrar menos' : `Mostrar los ${pending.length} casos pendientes`}
            </button>
          ) : null}
        </>
      ) : (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-900">
          Todas las eventualidades fueron confirmadas o revisadas.
        </div>
      )}
    </div>
  );
}

function DetailCard({
  employee,
  detail,
  disabled,
  manualTime,
  onManualTimeChange,
  onApply,
  onAddIrregularPunch,
}) {
  const differenceMin = Number(detail?.diferenciaMin || employee.diferenciaMin || 0);
  const isMissing = differenceMin > 0;
  const defaultTime = defaultAdjustmentTime(employee, detail);
  const adjustmentTime = manualTime ?? defaultTime;
  const adjustmentMinutes = Math.abs(parseDurationToMinutes(adjustmentTime));
  const justifiedAvailable = parseDurationToMinutes(employee.tiempoNoTrabajadoJustificado);
  const unjustifiedAvailable = parseDurationToMinutes(employee.tiempoNoTrabajadoNoJustificado);
  const canReduceJustified = isMissing || justifiedAvailable > 0;
  const canReduceUnjustified = isMissing || unjustifiedAvailable > 0;
  const scopeLabel = `fila ${detail?.fila || '-'} ${detail?.fecha || ''}`.trim();

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-slate-950">
              Fila {detail?.fila || '-'} · {detail?.fecha || 'sin fecha'} · {detail?.dia || 'sin dia'}
            </span>
            <span className={`rounded-md px-2 py-1 text-xs font-semibold ${isMissing ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
              Descuadre {detail?.diferencia || employee.diferencia}
            </span>
          </div>
          <p className="mt-1 text-xs font-medium text-slate-700">{detail?.posibleFallo || employee.posibleCausa}</p>
        </div>

        <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500 sm:min-w-40">
          Tiempo del ajuste
          <input
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            value={adjustmentTime}
            placeholder="HH:MM:SS"
            disabled={disabled}
            onChange={(event) => onManualTimeChange(event.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <span className="block text-xs font-semibold uppercase text-slate-500">Entrada / salida</span>
          <span className="font-medium">{fieldValue(detail, 'entrada')} / {fieldValue(detail, 'salida')}</span>
        </div>
        <div>
          <span className="block text-xs font-semibold uppercase text-slate-500">Observacion</span>
          <span className="font-medium">{fieldValue(detail, 'observacion')}</span>
        </div>
        <div>
          <span className="block text-xs font-semibold uppercase text-slate-500">Tiempo obs.</span>
          <span className="font-medium">{fieldValue(detail, 'tiempoObservaciones')}</span>
        </div>
        <div>
          <span className="block text-xs font-semibold uppercase text-slate-500">Estado</span>
          <span className="font-medium">{fieldValue(detail, 'estadoFinal', 'Sin estado')}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <MetricPill label="Esperadas" value={detail?.horasEsperadas || '00:00:00'} />
        <MetricPill label="Reconocidas" value={detail?.horasReconocidas || '00:00:00'} tone="green" />
        <MetricPill label="Justificado" value={detail?.tiempoJustificado || '00:00:00'} tone="amber" />
        <MetricPill label="No justificado" value={detail?.tiempoNoJustificado || '00:00:00'} tone="rose" />
        <MetricPill label="Explicado" value={detail?.totalCalculado || '00:00:00'} tone="navy" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <AdjustmentButton
          tone="amber"
          disabled={disabled}
          onClick={() => onAddIrregularPunch(employee, detail)}
        >
          <span className="inline-flex items-center gap-1">
            <Fingerprint className="h-3.5 w-3.5" />
            Agregar ponchado irregular
          </span>
        </AdjustmentButton>
        <AdjustmentButton
          disabled={disabled || !adjustmentMinutes || !canReduceJustified}
          onClick={() =>
            onApply('justified', {
              adjustmentMinutes,
              differenceMin,
              scopeLabel,
            })
          }
        >
          {isMissing ? 'Sumar a justificado' : 'Reducir justificado'}
        </AdjustmentButton>
        <AdjustmentButton
          tone="navy"
          disabled={disabled || !adjustmentMinutes || !canReduceUnjustified}
          onClick={() =>
            onApply('unjustified', {
              adjustmentMinutes,
              differenceMin,
              scopeLabel,
            })
          }
        >
          {isMissing ? 'Sumar a no justificado' : 'Reducir no justificado'}
        </AdjustmentButton>
      </div>
    </article>
  );
}

function EmployeeAuditCard({ row, index, disabled, onAdjust, onAddIrregularPunch }) {
  const [expanded, setExpanded] = useState(index === 0);
  const [manualTimes, setManualTimes] = useState({});
  const isMissing = row.diferenciaMin > 0;
  const details = row.detalles ?? [];
  const justifiedAvailable = parseDurationToMinutes(row.tiempoNoTrabajadoJustificado);
  const unjustifiedAvailable = parseDurationToMinutes(row.tiempoNoTrabajadoNoJustificado);
  const employeeAdjustmentMinutes = Math.abs(Number(row.diferenciaMin || 0));

  function updateDetailTime(detail, value) {
    setManualTimes((current) => ({
      ...current,
      [detailKey(row, detail)]: value,
    }));
  }

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
      <button
        className="flex w-full flex-col gap-4 bg-slate-50 p-4 text-left transition hover:bg-slate-100 lg:flex-row lg:items-start lg:justify-between"
        type="button"
        onClick={() => setExpanded((current) => !current)}
      >
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-900 text-white">
            <UserRound className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-950">{row.nombre}</h3>
              <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                {row.codigo}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {row.ubicacion || 'Sin ubicacion'}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-4 w-4" />
                {row.tipoHorario || 'Sin horario'}
              </span>
              <span className="inline-flex items-center gap-1">
                <PencilLine className="h-4 w-4" />
                {details.length} registro(s) a revisar
              </span>
            </div>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[700px] xl:grid-cols-5">
          <MetricPill label="Esperadas" value={durationFromHours(row.horasEsperadas)} />
          <MetricPill label="Reconocidas" value={durationFromHours(row.horasReconocidas)} tone="green" />
          <MetricPill label="Explicado" value={row.totalCalculado} tone="navy" />
          <MetricPill label="Descuadre" value={row.diferencia} tone={isMissing ? 'amber' : 'rose'} />
          <div className="flex items-center justify-end text-slate-500">
            {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </div>
        </div>
      </button>

      {expanded ? (
        <div className="space-y-4 border-t border-slate-200 p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <div className="font-semibold">Posible causa</div>
              <p className="mt-1">{row.posibleCausa}</p>
              <p className="mt-2 text-xs">
                Puedes resolver todo el descuadre del empleado o aplicar un ajuste por cada registro encontrado.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <AdjustmentButton
                disabled={disabled || !employeeAdjustmentMinutes || (!isMissing && justifiedAvailable <= 0)}
                onClick={() =>
                  onAdjust(row, 'justified', {
                    adjustmentMinutes: employeeAdjustmentMinutes,
                    differenceMin: row.diferenciaMin,
                    scopeLabel: 'empleado completo',
                  })
                }
              >
                {isMissing ? 'Sumar todo a justificado' : 'Reducir todo justificado'}
              </AdjustmentButton>
              <AdjustmentButton
                tone="navy"
                disabled={disabled || !employeeAdjustmentMinutes || (!isMissing && unjustifiedAvailable <= 0)}
                onClick={() =>
                  onAdjust(row, 'unjustified', {
                    adjustmentMinutes: employeeAdjustmentMinutes,
                    differenceMin: row.diferenciaMin,
                    scopeLabel: 'empleado completo',
                  })
                }
              >
                {isMissing ? 'Sumar todo a no justificado' : 'Reducir todo no justificado'}
              </AdjustmentButton>
            </div>
          </div>

          {details.length ? (
            <div className="grid gap-3">
              {details.map((detail) => {
                const key = detailKey(row, detail);
                return (
                  <DetailCard
                    key={key}
                    employee={row}
                    detail={detail}
                    disabled={disabled}
                    manualTime={manualTimes[key]}
                    onManualTimeChange={(value) => updateDetailTime(detail, value)}
                    onApply={(bucket, options) => onAdjust(row, bucket, options)}
                    onAddIrregularPunch={onAddIrregularPunch}
                  />
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              No hay registros diarios identificados. Usa el ajuste del empleado completo.
            </div>
          )}
        </div>
      ) : null}
    </article>
  );
}

export default function AuditReviewPanel({
  audit,
  disabled,
  onAdjust,
  onAddIrregularPunch,
  onResolveEventuality,
}) {
  const pending = useMemo(() => audit?.pendingEmployees ?? [], [audit]);
  if (!audit) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-950">Auditoria de cuadre</h2>
            <AuditBadge hasDiscrepancies={audit.hasDiscrepancies} />
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Revisa cada empleado y ajusta el tiempo directamente por registro cuando el Excel venga con errores.
          </p>
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-3 lg:min-w-[420px]">
          <MetricPill
            label="Empleados"
            value={`${audit.general.empleadosCuadrados}/${audit.general.totalEmpleados} cuadrados`}
          />
          <MetricPill label="Diferencia" value={audit.general.diferencia} tone={audit.general.diferenciaMin ? 'rose' : 'green'} />
          <MetricPill
            label="Estado"
            value={audit.hasDiscrepancies ? 'Requiere revisión' : audit.general.estadoCuadre}
            tone={audit.hasDiscrepancies ? 'amber' : 'green'}
          />
        </div>
      </div>

      <EventualityReconciliation
        reconciliation={audit.eventuality}
        disabled={disabled}
        onResolve={onResolveEventuality}
      />

      {pending.length ? (
        <div className="mt-4 space-y-4">
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Hay empleados con descuadre. Abre cada caso, revisa los registros detectados y aplica el tiempo correcto
              antes de cerrar el reporte.
            </span>
          </div>
          {pending.map((row, index) => (
            <EmployeeAuditCard
              key={`${row.ubicacion}-${row.codigo}`}
              row={row}
              index={index}
              disabled={disabled}
              onAdjust={onAdjust}
              onAddIrregularPunch={onAddIrregularPunch}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-900">
          Todos los empleados y el total general estan cuadrados.
        </div>
      )}
    </section>
  );
}
