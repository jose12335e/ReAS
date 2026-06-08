import { Clock3, Info, ShieldCheck } from 'lucide-react';
import { SCHEDULE_TYPES, scheduleConfig } from '../config/scheduleConfig.js';
import ModifiedScheduleEditor from './ModifiedScheduleEditor.jsx';

function RuleCard({ title, items, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    blue: 'border-sky-200 bg-sky-50 text-sky-800',
  };

  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScheduleSummary({ schedule }) {
  const workDays = Object.entries(schedule.days)
    .filter(([, day]) => day.expectedHours > 0)
    .map(([dayIndex, day]) => {
      const dayLabels = {
        0: 'Domingo',
        1: 'Lunes',
        2: 'Martes',
        3: 'Miércoles',
        4: 'Jueves',
        5: 'Viernes',
        6: 'Sábado',
      };
      return `${dayLabels[dayIndex]} ${day.entry ?? '--'}-${day.exit ?? '--'} (${day.expectedHours}h)`;
    });

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Clock3 className="h-5 w-5 text-teal-700" />
        <h3 className="text-sm font-semibold text-slate-950">{schedule.label}</h3>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {workDays.map((item) => (
          <span key={item} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function RulesPanel({
  defaultScheduleType,
  modifiedSchedule,
  disabled,
  onModifiedScheduleChange,
}) {
  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-900 text-white">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-950">Configuración de reglas</h2>
            <p className="mt-1 text-sm text-slate-600">
              Estas reglas gobiernan el cálculo de días, horas esperadas, tiempo reconocido y eventualidades.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ScheduleSummary schedule={scheduleConfig[SCHEDULE_TYPES.NORMAL]} />
        <ScheduleSummary schedule={scheduleConfig[SCHEDULE_TYPES.EXTENDED]} />
        <ScheduleSummary schedule={scheduleConfig[SCHEDULE_TYPES.MODIFIED]} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RuleCard
          title="Horas y ausencias"
          tone="blue"
          items={[
            'HN: cada día exigible equivale a 8 horas.',
            'HE: lunes a viernes equivale a 11 horas.',
            'HE: sábado equivale a 4 horas según configuración actual.',
            'Ausencias HN = 8 horas; ausencias HE = 11 horas.',
          ]}
        />
        <RuleCard
          title="Tiempo justificado"
          tone="green"
          items={[
            'Licencias se calculan como ausencias justificadas.',
            'Permisos toman el tiempo desde TIEMPO DE OBSERVACIONES cuando existe.',
            'Vacaciones se restan de días laborables y no cuentan como eventualidad.',
            'Ver viático reconoce el día completo como trabajo externo.',
          ]}
        />
        <RuleCard
          title="Advertencias y auditoría"
          tone="amber"
          items={[
            'Ponches irregulares quedan pendientes de revisión.',
            'La auditoría valida: horas reconocidas + tiempo justificado + no justificado = horas esperadas.',
            'Si hay descuadre, el sistema muestra días/fila sugeridos para revisar.',
          ]}
        />
        <RuleCard
          title="Configuración editable"
          tone="slate"
          items={[
            'El horario modificado permite activar días, entrada y salida.',
            'Los horarios normal y extendido se muestran como reglas institucionales base.',
            'Cambiar horario reinicia el resultado para evitar mezclar cálculos.',
          ]}
        />
      </div>

      {defaultScheduleType === SCHEDULE_TYPES.MODIFIED ? (
        <ModifiedScheduleEditor
          value={modifiedSchedule}
          disabled={disabled}
          onChange={onModifiedScheduleChange}
        />
      ) : (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Para editar días y horarios de trabajo, selecciona “Horario modificado” en el encabezado.
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
