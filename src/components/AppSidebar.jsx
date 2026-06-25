import { BookOpen, HelpCircle, LogOut, ShieldCheck } from 'lucide-react';

export default function AppSidebar({
  tabs,
  activeTab,
  activeUser,
  onTabChange,
  onLogout,
}) {
  return (
    <aside className="hidden border-r border-slate-200 bg-white px-4 py-5 shadow-sm shadow-slate-200/70 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:h-screen lg:w-72 lg:flex-col lg:overflow-y-auto">
      <div className="flex items-center gap-3 px-2">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-700 text-white shadow-sm">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <div>
          <div className="text-base font-semibold text-slate-950">ReAS</div>
          <div className="text-xs font-medium text-slate-500">Gestión Humana</div>
        </div>
      </div>

      <nav className="mt-8 grid gap-1.5" aria-label="Secciones del sistema">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                active
                  ? 'bg-teal-700 text-white shadow-sm shadow-teal-900/20'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
              } ${tab.disabled ? 'cursor-not-allowed opacity-45' : ''}`}
              type="button"
              disabled={tab.disabled}
              onClick={() => onTabChange(tab.id)}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{tab.label}</span>
                <span className={`mt-0.5 block truncate text-xs ${active ? 'text-teal-50' : 'text-slate-400'}`}>
                  {tab.description}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3">
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3 text-sky-950">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BookOpen className="h-4 w-4" />
            Ayuda
          </div>
          <p className="mt-1 text-xs leading-5 text-sky-800">
            Verifica mapeos, mes evaluado y auditoría antes de exportar.
          </p>
          <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-sky-700">
            <HelpCircle className="h-3.5 w-3.5" />
            Documentación interna
          </div>
        </div>

        {activeUser ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Sesión activa</div>
            <div className="mt-1 truncate text-sm font-semibold text-slate-950">{activeUser.name}</div>
            <div className="mt-0.5 truncate text-xs text-slate-500">
              {activeUser.role} · {activeUser.code}
            </div>
            <button
              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              type="button"
              onClick={onLogout}
            >
              <LogOut className="h-3.5 w-3.5" />
              Cerrar sesión
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
