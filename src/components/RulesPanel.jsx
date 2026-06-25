import { AlertTriangle, Info, Settings2, ShieldCheck } from 'lucide-react';
import { SCHEDULE_TYPES, buildModifiedSchedule, scheduleConfig } from '../config/scheduleConfig.js';
import InfoPanel from './InfoPanel.jsx';
import ModifiedScheduleEditor from './ModifiedScheduleEditor.jsx';
import RuleCard from './RuleCard.jsx';

export default function RulesPanel({
  defaultScheduleType,
  modifiedSchedule,
  disabled,
  onModifiedScheduleChange,
  onSelectModifiedSchedule,
}) {
  const modifiedDefinition = buildModifiedSchedule(modifiedSchedule);

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase text-teal-700">Reglas de cálculo</div>
            <h2 className="mt-1 text-xl font-semibold tracking-normal text-slate-950">
              Horarios y criterios institucionales
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Visualiza las reglas activas sin alterar el procesamiento. El horario modificado permite ajustar días,
              entrada y salida cuando el período lo requiere.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <RuleCard
          title="Horario normal"
          description="Lunes a viernes"
          schedule={scheduleConfig[SCHEDULE_TYPES.NORMAL]}
          active={defaultScheduleType === SCHEDULE_TYPES.NORMAL}
          tone="teal"
        />
        <RuleCard
          title="Horario extendido"
          description="Lunes a sábado"
          schedule={scheduleConfig[SCHEDULE_TYPES.EXTENDED]}
          active={defaultScheduleType === SCHEDULE_TYPES.EXTENDED}
          tone="blue"
        />
        <RuleCard
          title="Horario modificado"
          description="Editable desde la interfaz"
          schedule={modifiedDefinition}
          active={defaultScheduleType === SCHEDULE_TYPES.MODIFIED}
          tone="violet"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <InfoPanel icon={Info} title="Horas y ausencias" tone="blue">
          HN usa 8 horas por día. HE usa 11 horas de lunes a viernes y 4 horas los sábados.
          Las ausencias se valorizan según el tipo de horario del empleado.
        </InfoPanel>
        <InfoPanel icon={ShieldCheck} title="Tiempo justificado" tone="teal">
          Licencias, permisos y ausencias justificadas se reflejan como tiempo no trabajado justificado.
          Vacaciones se manejan en tabla aparte y ver viático reconoce el día como trabajado.
        </InfoPanel>
        <InfoPanel icon={AlertTriangle} title="Advertencias y auditoría" tone="amber">
          La auditoría compara horas reconocidas + tiempo justificado + tiempo no justificado contra las horas
          esperadas. Si no cuadra, muestra empleado, fila y posible causa.
        </InfoPanel>
        <InfoPanel icon={Settings2} title="Configuración editable" tone="violet">
          Para editar días y horarios de trabajo, selecciona Horario modificado.
        </InfoPanel>
      </div>

      {defaultScheduleType === SCHEDULE_TYPES.MODIFIED ? (
        <ModifiedScheduleEditor
          value={modifiedSchedule}
          disabled={disabled}
          onChange={onModifiedScheduleChange}
        />
      ) : (
        <InfoPanel
          icon={Settings2}
          title="Editar horario de trabajo"
          tone="blue"
          action={
            <button
              className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm shadow-slate-900/10 transition hover:bg-slate-800"
              type="button"
              onClick={onSelectModifiedSchedule}
            >
              Ir a Horario modificado
            </button>
          }
        >
          Para editar días y horarios de trabajo, selecciona Horario modificado.
        </InfoPanel>
      )}
    </section>
  );
}
