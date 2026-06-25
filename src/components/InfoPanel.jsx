export default function InfoPanel({ icon: Icon, title, children, tone = 'slate', action }) {
  const tones = {
    teal: 'border-teal-200 bg-teal-50 text-teal-950',
    blue: 'border-sky-200 bg-sky-50 text-sky-950',
    amber: 'border-amber-200 bg-amber-50 text-amber-950',
    rose: 'border-rose-200 bg-rose-50 text-rose-950',
    violet: 'border-violet-200 bg-violet-50 text-violet-950',
    slate: 'border-slate-200 bg-white text-slate-800',
  };

  const iconTones = {
    teal: 'bg-teal-100 text-teal-700',
    blue: 'bg-sky-100 text-sky-700',
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
    violet: 'bg-violet-100 text-violet-700',
    slate: 'bg-slate-100 text-slate-600',
  };

  return (
    <section className={`rounded-2xl border p-4 shadow-sm shadow-slate-200/60 ${tones[tone]}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          {Icon ? (
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${iconTones[tone]}`}>
              <Icon className="h-5 w-5" />
            </span>
          ) : null}
          <div>
            {title ? <h3 className="text-sm font-semibold text-slate-950">{title}</h3> : null}
            <div className="mt-1 text-sm leading-6 text-slate-700">{children}</div>
          </div>
        </div>
        {action}
      </div>
    </section>
  );
}
