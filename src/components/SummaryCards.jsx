import { Check, ClipboardList, Copy } from 'lucide-react';
import { useState } from 'react';
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
import { parseDurationToMinutes } from '../utils/timeUtils.js';

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

function formatNumber(value) {
  return Number(value || 0).toLocaleString('es-DO');
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0))}%`;
}

function hoursToDuration(value) {
  const minutes = Math.round(Number(value || 0) * 60);
  return minutesToDuration(minutes);
}

function minutesToDuration(totalMinutes = 0) {
  const safeMinutes = Math.max(0, Math.round(Number(totalMinutes || 0)));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:00`;
}

function durationToDisplay(value) {
  return minutesToDuration(parseDurationToMinutes(value));
}

function getEmployeeName(employee) {
  return String(employee?.nombre || employee?.codigo || 'Sin nombre').trim();
}

function buildRankingLines(employees = [], { title, valueKey, suffix, formatter = formatNumber, limit = 5 }) {
  const rankedEmployees = employees
    .map((employee) => ({
      name: getEmployeeName(employee),
      value: valueKey === 'tiempoNoTrabajadoNoJustificado'
        ? parseDurationToMinutes(employee[valueKey])
        : Number(employee[valueKey] || 0),
      rawValue: employee[valueKey],
    }))
    .filter((employee) => employee.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'es'))
    .slice(0, limit);

  return [
    { type: 'section', label: title },
    ...(rankedEmployees.length
      ? rankedEmployees.map((employee) => ({
          type: 'rank',
          label: employee.name,
          value: `${formatter(employee.rawValue)} ${suffix}`,
        }))
      : [{ type: 'rank', label: 'Sin registros', value: '' }]),
  ];
}

function SummaryLine({ line, label, value }) {
  if (line?.type === 'section') {
    return (
      <li className="pt-2 text-sm font-semibold uppercase text-slate-950 first:pt-0">
        {line.label}
      </li>
    );
  }

  const displayLabel = line?.label ?? label;
  const displayValue = line?.value ?? value;
  const separator = line?.type === 'rank' ? ' – ' : ': ';

  return (
    <li className="flex items-start gap-3">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900" />
      <span className="min-w-0 text-sm italic text-slate-700">
        {displayLabel}
        {displayValue ? (
          <>
            {separator}<strong className="font-semibold text-slate-950">{displayValue}</strong>
          </>
        ) : null}
      </span>
    </li>
  );
}

function blockToText(title, lines) {
  return [
    title,
    ...lines.map((line) => {
      if (line.type === 'section') return `\n${line.label}`;
      if (line.type === 'rank') return line.value ? `- ${line.label} – ${line.value}` : `- ${line.label}`;
      return line.value ? `- ${line.label}: ${line.value}` : `- ${line.label}`;
    }),
  ].join('\n');
}

function SummaryBlock({ title, lines, onCopy, copied }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
        <button
          className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-xs font-semibold transition ${
            copied
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700'
          }`}
          type="button"
          title="Copiar este cuadro"
          aria-label={`Copiar ${title}`}
          onClick={() => onCopy(title, lines)}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {lines.map((line, index) => (
          <SummaryLine key={`${line.type ?? 'line'}-${line.label}-${index}`} line={line} />
        ))}
      </ul>
    </div>
  );
}

export default function SummaryCards({ result }) {
  const [copiedBlock, setCopiedBlock] = useState('');

  if (!result) return null;

  const summary = result.summaryGeneral;
  const diasCumplimiento =
    summary.diasATrabajar > 0
      ? (Number(summary.diasTrabajadosCompletos || 0) / Number(summary.diasATrabajar || 0)) * 100
      : 0;
  const horasCumplimiento =
    summary.horasEsperadas > 0
      ? (Number(summary.horasReconocidas || 0) / Number(summary.horasEsperadas || 0)) * 100
      : 0;
  const tiempoEventualidadesNoJustificadasMin =
    parseDurationToMinutes(summary.tiempoTardanzaNoJustificada) +
    parseDurationToMinutes(summary.tiempoSalidaTempranaNoJustificada) +
    parseDurationToMinutes(summary.tiempoAusenciaNoJustificada);
  const tiempoGeneralEventualidadesMin =
    parseDurationToMinutes(summary.tiempoEventualidadJustificada) + tiempoEventualidadesNoJustificadasMin;
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
  const rankingLines = [
    ...buildRankingLines(result.summaryByEmployee, {
      title: 'Personas con más AUSENCIAS',
      valueKey: 'ausenciasNoJustificadas',
      suffix: 'ausencias',
    }),
    ...buildRankingLines(result.summaryByEmployee, {
      title: 'Personas con más TARDANZAS',
      valueKey: 'tardanzasNoJustificadas',
      suffix: 'tardanzas',
    }),
    ...buildRankingLines(result.summaryByEmployee, {
      title: 'Personas con más SALIDAS TEMPRANAS',
      valueKey: 'salidasTempranasNoJustificadas',
      suffix: 'salidas tempranas',
    }),
    ...buildRankingLines(result.summaryByEmployee, {
      title: 'Personas con mayor TIEMPO ACUMULADO',
      valueKey: 'tiempoNoTrabajadoNoJustificado',
      suffix: 'horas',
      formatter: durationToDisplay,
    }),
  ];
  const summaryBlocks = [
    {
      id: 'tiempo-dias',
      title: 'Tiempo y días a trabajar vs tiempo y días trabajado',
      lines: [
        { label: 'Días a trabajar', value: formatNumber(summary.diasATrabajar) },
        { label: 'Días trabajados', value: formatNumber(summary.diasTrabajadosCompletos) },
        { label: 'Representando un cumplimiento de', value: formatPercent(diasCumplimiento) },
        { label: 'Horas a trabajar', value: hoursToDuration(summary.horasEsperadas) },
        { label: 'Horas trabajadas', value: hoursToDuration(summary.horasReconocidas) },
        { label: 'Representando un cumplimiento de', value: formatPercent(horasCumplimiento) },
        { label: 'Tasa de ausentismo', value: formatPercent(summary.tasaAusentismo) },
      ],
    },
    {
      id: 'tiempo-general',
      title: 'Tiempo general acumulado en eventualidades',
      lines: [
        {
          label: 'Tiempo acumulado de eventualidades justificadas y no justificadas',
          value: minutesToDuration(tiempoGeneralEventualidadesMin),
        },
        { label: 'Ver viático', value: formatNumber(summary.verViatico) },
        { label: 'Ponches irregulares', value: formatNumber(summary.ponchesIrregulares) },
      ],
    },
    {
      id: 'justificadas',
      title: 'Eventualidades justificadas registradas',
      lines: [
        { label: 'Eventualidades justificadas', value: formatNumber(summary.eventualidadesJustificadas) },
        { label: 'Tiempo acumulado', value: durationToDisplay(summary.tiempoEventualidadJustificada) },
      ],
    },
    {
      id: 'no-justificadas',
      title: 'Eventualidades no justificadas registradas',
      lines: [
        { label: 'Tardanzas', value: formatNumber(summary.tardanzasNoJustificadas) },
        { label: 'Tiempo de tardanza acumulado', value: durationToDisplay(summary.tiempoTardanzaNoJustificada) },
        { label: 'Salidas tempranas', value: formatNumber(summary.salidasTempranasNoJustificadas) },
        {
          label: 'Tiempo de salidas tempranas acumulado',
          value: durationToDisplay(summary.tiempoSalidaTempranaNoJustificada),
        },
        { label: 'Ausencias', value: formatNumber(summary.ausenciasNoJustificadas) },
        { label: 'Tiempo de ausencias acumulado', value: durationToDisplay(summary.tiempoAusenciaNoJustificada) },
        { label: 'Tiempo total no justificado', value: minutesToDuration(tiempoEventualidadesNoJustificadasMin) },
      ],
    },
    {
      id: 'ranking-eventualidades',
      title: 'Ranking de eventualidades por colaborador',
      lines: rankingLines,
    },
  ];

  async function handleCopyBlock(title, lines) {
    const text = blockToText(title, lines);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedBlock(title);
      window.setTimeout(() => setCopiedBlock(''), 1600);
    } catch {
      setCopiedBlock('');
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal-50 text-teal-700">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-950">Resumen para reporte</h2>
            <p className="text-sm text-slate-600">Datos listos para copiar al cuadro institucional.</p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          {summaryBlocks.map((block) => (
            <SummaryBlock
              key={block.id}
              title={block.title}
              lines={block.lines}
              copied={copiedBlock === block.title}
              onCopy={handleCopyBlock}
            />
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">Clasificación disciplinaria</h2>
          <p className="mt-1 text-sm text-slate-600">
            Referencia institucional por acumulados mensuales no justificados.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {disciplinaryRows.map((row) => (
            <div key={row.key} className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
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

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
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
