import { Clock3 } from 'lucide-react';

export default function RuleCard({
  title,
  description,
  schedule,
  tone = 'teal',
  active,
}) {
  const tones = {
    teal: 'border-teal-200 bg-teal-50/70 text-teal-700',
    blue: 'border-sky-200 bg-sky-50/70 text-sky-700',
    violet: 'border-violet-200 bg-violet-50/70 text-violet-700',
  };

  const workDays = Object.entries(schedule.days)
    .filter(([, day]) => day.expectedHours > 0)
    .map(([dayIndex, day]) => {
      const dayLabels = {
        0: 'Dom',
        1: 'Lun',
        2: 'Mar',
        3: 'Mié',
        4: 'Jue',
        5: 'Vie',
        6: 'Sáb',
      };
      return {
        label: dayLabels[dayIndex],
        detail: `${day.entry ?? '--'}-${day.exit ?? '--'}`,
        hours: day.expectedHours,
      };
    });
  const weeklyHours = workDays.reduce((total, day) => total + Number(day.hours || 0), 0);

  return (
    <article className={`rounded-2xl border bg-white p-5 shadow-sm shadow-slate-200/70 ${active ? 'ring-2 ring-teal-100' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`grid h-10 w-10 place-items-center rounded-xl border ${tones[tone]}`}>
              <Clock3 className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-950">{title}</h3>
              <p className="text-xs font-medium text-slate-500">{description}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-slate-950 px-3 py-2 text-right text-white">
          <div className="text-lg font-semibold">{weeklyHours}h</div>
          <div className="text-[11px] font-semibold uppercase text-slate-300">semanal</div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {workDays.map((day) => (
          <span key={`${day.label}-${day.detail}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
            {day.label} · {day.hours}h
            <span className="ml-1 font-medium text-slate-400">{day.detail}</span>
          </span>
        ))}
      </div>
    </article>
  );
}
