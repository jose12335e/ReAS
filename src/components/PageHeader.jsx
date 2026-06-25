import { LogOut, UserCheck } from 'lucide-react';

export default function PageHeader({
  title,
  subtitle,
  breadcrumb = [],
  activeUser,
  onLogout,
  actions,
}) {
  return (
    <header className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/70 sm:px-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.8fr)_minmax(500px,1.35fr)_minmax(290px,0.65fr)] xl:items-start">
        <div className="min-w-0 xl:pt-1">
          <div className="flex flex-wrap items-center gap-1 text-xs font-semibold uppercase text-slate-400">
            {breadcrumb.map((item, index) => (
              <span key={`${item}-${index}`} className="flex items-center gap-1">
                <span className={index === breadcrumb.length - 1 ? 'text-teal-700' : ''}>{item}</span>
                {index < breadcrumb.length - 1 ? <span>/</span> : null}
              </span>
            ))}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">
            {title}
          </h1>
          {subtitle ? <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{subtitle}</p> : null}
        </div>

        <div className="min-w-0">{actions}</div>

        {activeUser ? (
          <div className="rounded-xl border border-teal-100 bg-teal-50/70 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-teal-700 ring-1 ring-teal-100">
                  <UserCheck className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase text-teal-700">Sesión activa</div>
                  <div className="mt-0.5 truncate text-sm font-semibold text-slate-950">{activeUser.name}</div>
                  <div className="truncate text-xs font-medium text-slate-600">
                    {activeUser.role} · {activeUser.code}
                  </div>
                </div>
              </div>
              <button
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200 transition hover:text-rose-600"
                type="button"
                title="Cerrar sesión"
                onClick={onLogout}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
