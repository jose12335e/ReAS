export default function MetricCard({
  icon: Icon,
  label,
  value,
  description,
  tone = 'teal',
  indicator,
}) {
  const tones = {
    teal: 'border-teal-100 bg-teal-50 text-teal-700',
    blue: 'border-sky-100 bg-sky-50 text-sky-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    rose: 'border-rose-100 bg-rose-50 text-rose-700',
    violet: 'border-violet-100 bg-violet-50 text-violet-700',
    slate: 'border-slate-100 bg-slate-50 text-slate-700',
  };

  const bars = {
    teal: 'bg-teal-600',
    blue: 'bg-sky-600',
    amber: 'bg-amber-500',
    rose: 'bg-rose-600',
    violet: 'bg-violet-600',
    slate: 'bg-slate-600',
  };

  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
          <div className="mt-2 truncate text-2xl font-semibold tracking-normal text-slate-950">
            {value}
          </div>
        </div>
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {description ? <p className="mt-3 text-sm leading-5 text-slate-600">{description}</p> : null}
      <div className="mt-4 flex items-center gap-2">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <span className={`block h-full rounded-full ${bars[tone]}`} style={{ width: indicator ?? '64%' }} />
        </span>
        {indicator ? <span className="text-xs font-semibold text-slate-500">{indicator}</span> : null}
      </div>
    </article>
  );
}
