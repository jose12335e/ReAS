import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { parseDurationToMinutes } from '../utils/auditRules.js';

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

export default function AuditReviewPanel({ audit, disabled, onAdjust }) {
  if (!audit) return null;

  const pending = audit.pendingEmployees ?? [];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-950">Auditoria de cuadre</h2>
            <AuditBadge hasDiscrepancies={audit.hasDiscrepancies} />
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Verifica que horas reconocidas mas tiempo no trabajado expliquen exactamente las horas a trabajar.
          </p>
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-3 lg:min-w-[420px]">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-xs font-semibold uppercase text-slate-500">Empleados</div>
            <div className="mt-1 font-semibold text-slate-900">
              {audit.general.empleadosCuadrados}/{audit.general.totalEmpleados} cuadrados
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-xs font-semibold uppercase text-slate-500">Diferencia</div>
            <div className="mt-1 font-semibold text-slate-900">{audit.general.diferencia}</div>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-xs font-semibold uppercase text-slate-500">Estado</div>
            <div className="mt-1 font-semibold text-slate-900">{audit.general.estadoCuadre}</div>
          </div>
        </div>
      </div>

      {pending.length ? (
        <div className="mt-4">
          <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Hay empleados con descuadre. Revisa cada caso y aplica el ajuste donde corresponda antes de cerrar el
              reporte.
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-900 text-left text-xs uppercase text-white">
                  <th className="border border-slate-200 px-3 py-2">Empleado</th>
                  <th className="border border-slate-200 px-3 py-2">Ubicacion</th>
                  <th className="border border-slate-200 px-3 py-2 text-right">Esperadas</th>
                  <th className="border border-slate-200 px-3 py-2 text-right">Reconocidas</th>
                  <th className="border border-slate-200 px-3 py-2 text-right">Total explicado</th>
                  <th className="border border-slate-200 px-3 py-2 text-right">Descuadre</th>
                  <th className="border border-slate-200 px-3 py-2">Ajuste</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((row) => {
                  const isMissing = row.diferenciaMin > 0;
                  const justifiedAvailable = parseDurationToMinutes(row.tiempoNoTrabajadoJustificado);
                  const unjustifiedAvailable = parseDurationToMinutes(row.tiempoNoTrabajadoNoJustificado);
                  return (
                    <tr key={`${row.ubicacion}-${row.codigo}`} className="align-top">
                      <td className="border border-slate-200 px-3 py-2">
                        <div className="font-semibold text-slate-900">{row.nombre}</div>
                        <div className="text-xs text-slate-500">{row.codigo}</div>
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-slate-700">{row.ubicacion}</td>
                      <td className="border border-slate-200 px-3 py-2 text-right">{row.horasEsperadas}</td>
                      <td className="border border-slate-200 px-3 py-2 text-right">{row.horasReconocidas}</td>
                      <td className="border border-slate-200 px-3 py-2 text-right">{row.totalCalculado}</td>
                      <td
                        className={`border border-slate-200 px-3 py-2 text-right font-semibold ${
                          isMissing ? 'text-amber-700' : 'text-rose-700'
                        }`}
                      >
                        {row.diferencia}
                      </td>
                      <td className="border border-slate-200 px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                            type="button"
                            disabled={disabled || (!isMissing && justifiedAvailable <= 0)}
                            onClick={() => onAdjust(row, 'justified')}
                          >
                            {isMissing ? 'Sumar a justificado' : 'Reducir justificado'}
                          </button>
                          <button
                            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                            type="button"
                            disabled={disabled || (!isMissing && unjustifiedAvailable <= 0)}
                            onClick={() => onAdjust(row, 'unjustified')}
                          >
                            {isMissing ? 'Sumar a no justificado' : 'Reducir no justificado'}
                          </button>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{row.posibleCausa}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-900">
          Todos los empleados y el total general estan cuadrados.
        </div>
      )}
    </section>
  );
}
