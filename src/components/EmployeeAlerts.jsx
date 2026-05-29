import { Building2, ShieldAlert, Trophy } from 'lucide-react';
import { parseDurationToMinutes } from '../utils/timeUtils.js';

const CATEGORY_WEIGHT = {
  none: 0,
  first: 10,
  second: 20,
  third: 30,
};

function formatDuration(value) {
  const totalMinutes = parseDurationToMinutes(value);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:00`;
}

function getHighestDisciplinary(employee) {
  const categories = [
    employee.disciplina?.ausencias,
    employee.disciplina?.tardanzas,
    employee.disciplina?.salidasTempranas,
  ].filter(Boolean);

  return categories.reduce(
    (highest, category) => {
      const weight = CATEGORY_WEIGHT[category.category] ?? 0;
      return weight > highest.weight ? { ...category, weight } : highest;
    },
    { category: 'none', label: 'Sin falta', colorName: 'Verde', chartColor: '#a9d18e', weight: 0 },
  );
}

function buildEmployeeAlert(employee) {
  const noJustificadoMin = parseDurationToMinutes(employee.tiempoNoTrabajadoNoJustificado);
  const tardanzaMin = parseDurationToMinutes(employee.tiempoTardanzaNoJustificada);
  const salidaMin = parseDurationToMinutes(employee.tiempoSalidaTempranaNoJustificada);
  const ausenciaMin = parseDurationToMinutes(employee.tiempoAusenciaNoJustificada);
  const highestDisciplinary = getHighestDisciplinary(employee);
  const ausencias = Number(employee.ausenciasNoJustificadas || 0);
  const tardanzas = Number(employee.tardanzasNoJustificadas || 0);
  const salidas = Number(employee.salidasTempranasNoJustificadas || 0);
  const score =
    ausencias * 10 +
    tardanzas * 2 +
    salidas * 2 +
    Math.round(noJustificadoMin / 60) +
    highestDisciplinary.weight;

  return {
    ...employee,
    noJustificadoMin,
    tardanzaMin,
    salidaMin,
    ausenciaMin,
    highestDisciplinary,
    score,
    group: employee.departamento || employee.ubicacion || 'Sin ubicación',
  };
}

function sortAlerts(a, b) {
  return (
    b.score - a.score ||
    b.noJustificadoMin - a.noJustificadoMin ||
    Number(b.ausenciasNoJustificadas || 0) - Number(a.ausenciasNoJustificadas || 0) ||
    String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es')
  );
}

function AlertRow({ employee, rank }) {
  return (
    <tr className="align-top odd:bg-white even:bg-slate-50/70">
      <td className="whitespace-nowrap px-3 py-2 text-sm font-semibold text-slate-700">#{rank}</td>
      <td className="px-3 py-2">
        <div className="font-semibold text-slate-950">{employee.nombre || employee.codigo}</div>
        <div className="text-xs text-slate-500">{employee.codigo}</div>
      </td>
      <td className="px-3 py-2 text-right text-sm font-semibold text-rose-700">
        {employee.ausenciasNoJustificadas}
      </td>
      <td className="px-3 py-2 text-right text-sm">{employee.tardanzasNoJustificadas}</td>
      <td className="px-3 py-2 text-right text-sm">{employee.salidasTempranasNoJustificadas}</td>
      <td className="px-3 py-2 text-right text-sm font-semibold text-slate-900">
        {formatDuration(employee.tiempoNoTrabajadoNoJustificado)}
      </td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: employee.highestDisciplinary.chartColor }}
          />
          {employee.highestDisciplinary.shortLabel || employee.highestDisciplinary.label}
        </span>
      </td>
      <td className="px-3 py-2 text-right text-sm font-semibold text-slate-900">{employee.score}</td>
    </tr>
  );
}

function AlertsTable({ employees }) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left">
          <thead className="bg-slate-900 text-xs uppercase text-white">
            <tr>
              <th className="px-3 py-2.5">#</th>
              <th className="px-3 py-2.5">Empleado</th>
              <th className="px-3 py-2.5 text-right">Ausencias</th>
              <th className="px-3 py-2.5 text-right">Tardanzas</th>
              <th className="px-3 py-2.5 text-right">Salidas</th>
              <th className="px-3 py-2.5 text-right">Tiempo no justificado</th>
              <th className="px-3 py-2.5">Gravedad</th>
              <th className="px-3 py-2.5 text-right">Puntaje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map((employee, index) => (
              <AlertRow key={`${employee.group}-${employee.codigo}-${index}`} employee={employee} rank={index + 1} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function EmployeeAlerts({ result }) {
  if (!result?.summaryByEmployee?.length) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm shadow-slate-200/70">
        Procesa un archivo para ver las alertas por departamento.
      </section>
    );
  }

  const alertEmployees = result.summaryByEmployee
    .map(buildEmployeeAlert)
    .filter((employee) => employee.score > 0)
    .sort(sortAlerts);

  const groups = Array.from(
    alertEmployees.reduce((map, employee) => {
      if (!map.has(employee.group)) map.set(employee.group, []);
      map.get(employee.group).push(employee);
      return map;
    }, new Map()),
  )
    .map(([group, employees]) => ({
      group,
      employees: employees.sort(sortAlerts).slice(0, 5),
      maxScore: employees[0]?.score ?? 0,
    }))
    .sort((a, b) => b.maxScore - a.maxScore || a.group.localeCompare(b.group, 'es'));

  const topGeneral = alertEmployees.slice(0, 10);

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-rose-50 text-rose-700">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-950">Alertas de supervisión</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                Ranking de empleados con mayor incidencia no justificada. No incluye vacaciones,
                licencias, permisos ni otras eventualidades justificadas.
              </p>
            </div>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
            Solo referencia para revisión humana
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Empleados con alerta</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{alertEmployees.length}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Departamentos afectados</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{groups.length}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Mayor puntaje</div>
            <div className="mt-1 text-2xl font-semibold text-rose-700">{topGeneral[0]?.score ?? 0}</div>
          </div>
        </div>
      </div>

      {topGeneral.length ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
          <div className="mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-600" />
            <h3 className="text-base font-semibold text-slate-950">Ranking general de incidencias</h3>
          </div>
          <AlertsTable employees={topGeneral} />
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          No hay empleados con incidencias no justificadas para destacar.
        </div>
      )}

      {groups.map((group) => (
        <div key={group.group} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-teal-700" />
            <h3 className="text-base font-semibold text-slate-950">{group.group}</h3>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
              Top {group.employees.length}
            </span>
          </div>
          <AlertsTable employees={group.employees} />
        </div>
      ))}
    </section>
  );
}
