import { LogIn, ShieldCheck, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { AUTHORIZED_UNIT, findAuthorizedUser, normalizeEmployeeCode } from '../config/authorizedUsers.js';

export default function LoginGate({ onLogin }) {
  const [employeeCode, setEmployeeCode] = useState('');
  const [error, setError] = useState('');
  const [matchedUser, setMatchedUser] = useState(null);

  function handleCodeChange(value) {
    const normalized = normalizeEmployeeCode(value);
    setEmployeeCode(normalized);
    setError('');
    setMatchedUser(findAuthorizedUser(normalized));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const user = findAuthorizedUser(employeeCode);

    if (!user) {
      setMatchedUser(null);
      setError('Codigo no autorizado.');
      return;
    }

    if (user.unit !== AUTHORIZED_UNIT) {
      setMatchedUser(null);
      setError('Empleado no autorizado para esta unidad.');
      return;
    }

    onLogin(user);
  }

  return (
    <main className="min-h-screen bg-[#eef3f7] px-4 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center">
        <div className="grid w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-300/70 lg:grid-cols-[1fr_420px]">
          <div className="bg-slate-950 p-8 text-white sm:p-10">
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-teal-600 shadow-sm">
              <ShieldCheck className="h-7 w-7" />
            </span>
            <p className="mt-8 text-sm font-semibold uppercase tracking-wide text-teal-200">ReAS</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Acceso a reportes de asistencia
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">
              Ingresa tu codigo de empleado para validar acceso a la unidad autorizada y registrar la sesion
              de trabajo.
            </p>
            <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              <div className="font-semibold text-white">Unidad autorizada</div>
              <div className="mt-1">{AUTHORIZED_UNIT}</div>
            </div>
          </div>

          <form className="p-6 sm:p-8" onSubmit={handleSubmit}>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal-50 text-teal-700">
                <UserCheck className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Iniciar sesion</h2>
                <p className="text-sm text-slate-500">Solo personal autorizado.</p>
              </div>
            </div>

            <label className="mt-8 grid gap-2">
              <span className="text-xs font-semibold uppercase text-slate-500">Codigo de empleado</span>
              <input
                className="h-12 rounded-md border border-slate-300 bg-white px-4 text-lg font-semibold tracking-wide text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                value={employeeCode}
                inputMode="numeric"
                autoFocus
                placeholder="Ej. 20210839"
                onChange={(event) => handleCodeChange(event.target.value)}
              />
            </label>

            {matchedUser ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                <div className="font-semibold">{matchedUser.name}</div>
                <div className="mt-1">{matchedUser.role}</div>
                <div className="mt-1 text-xs font-semibold uppercase text-emerald-700">{matchedUser.unit}</div>
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
                {error}
              </div>
            ) : null}

            <button
              className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              type="submit"
              disabled={!employeeCode}
            >
              <LogIn className="h-4 w-4" />
              Entrar a ReAS
            </button>

            <p className="mt-5 text-xs leading-5 text-slate-500">
              La sesion se conserva solo mientras este navegador permanezca abierto.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
