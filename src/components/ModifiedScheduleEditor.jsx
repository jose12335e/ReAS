import { Clock3 } from 'lucide-react';
import { DEFAULT_MODIFIED_SCHEDULE, WEEK_DAYS } from '../config/scheduleConfig.js';

function getDayConfig(schedule, dayIndex) {
  return (
    schedule?.days?.[dayIndex] ??
    schedule?.days?.[String(dayIndex)] ??
    DEFAULT_MODIFIED_SCHEDULE.days[dayIndex]
  );
}

function calculateHours(entry, exit) {
  const parse = (value) => {
    const match = String(value ?? '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  };
  const start = parse(entry);
  const end = parse(exit);
  if (start === null || end === null) return 0;
  const diff = end >= start ? end - start : end + 1440 - start;
  return Math.round((diff / 60) * 100) / 100;
}

export default function ModifiedScheduleEditor({ value, disabled, onChange }) {
  const schedule = value ?? DEFAULT_MODIFIED_SCHEDULE;

  function updateDay(dayIndex, patch) {
    const currentDay = getDayConfig(schedule, dayIndex);
    onChange({
      ...schedule,
      days: {
        ...schedule.days,
        [dayIndex]: {
          ...currentDay,
          ...patch,
        },
      },
    });
  }

  return (
    <section className="rounded-lg border border-teal-100 bg-white p-4 shadow-sm shadow-slate-200/70">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-50 text-teal-700">
            <Clock3 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-950">Horario modificado</h2>
            <p className="text-xs text-slate-500">
              Define los dias laborables y la ventana de trabajo que usara el Web Worker.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[720px] rounded-md border border-slate-200">
          <div className="grid grid-cols-[1.2fr_0.8fr_1fr_1fr_0.8fr] bg-slate-900 text-xs font-semibold uppercase text-white">
            <div className="px-3 py-2">Dia</div>
            <div className="px-3 py-2 text-center">Trabaja</div>
            <div className="px-3 py-2">Entrada</div>
            <div className="px-3 py-2">Salida</div>
            <div className="px-3 py-2 text-center">Horas</div>
          </div>
          {WEEK_DAYS.map((day) => {
            const dayConfig = getDayConfig(schedule, day.index);
            const enabled = Boolean(dayConfig.enabled);
            const hours = enabled ? calculateHours(dayConfig.entry, dayConfig.exit) : 0;

            return (
              <div
                key={day.index}
                className="grid grid-cols-[1.2fr_0.8fr_1fr_1fr_0.8fr] items-center border-t border-slate-200 text-sm"
              >
                <div className="px-3 py-2 font-semibold text-slate-800">{day.label}</div>
                <div className="px-3 py-2 text-center">
                  <input
                    className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                    type="checkbox"
                    checked={enabled}
                    disabled={disabled}
                    onChange={(event) => updateDay(day.index, { enabled: event.target.checked })}
                  />
                </div>
                <div className="px-3 py-2">
                  <input
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    type="time"
                    value={dayConfig.entry}
                    disabled={disabled || !enabled}
                    onChange={(event) => updateDay(day.index, { entry: event.target.value })}
                  />
                </div>
                <div className="px-3 py-2">
                  <input
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    type="time"
                    value={dayConfig.exit}
                    disabled={disabled || !enabled}
                    onChange={(event) => updateDay(day.index, { exit: event.target.value })}
                  />
                </div>
                <div className="px-3 py-2 text-center font-semibold text-slate-700">
                  {hours ? `${hours}h` : '0h'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
