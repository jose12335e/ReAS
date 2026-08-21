import { Component, useEffect, useState } from 'react';
import LoginGate from './components/LoginGate.jsx';
import Dashboard from './pages/Dashboard.jsx';

const SESSION_STORAGE_KEY = 'reas-active-user';

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  clearLocalData = () => {
    try {
      localStorage.removeItem('reas-attendance-config');
      indexedDB.deleteDatabase('reas-report-session');
      indexedDB.deleteDatabase('reas-local-database-handle');
    } catch {
      // Si el navegador bloquea algun almacenamiento, recargar sigue siendo la salida mas segura.
    }
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <main className="grid min-h-screen place-items-center bg-slate-100 p-6">
          <section className="max-w-xl rounded-2xl border border-rose-200 bg-white p-6 shadow-lg shadow-slate-200">
            <div className="text-xs font-semibold uppercase text-rose-600">ReAS encontro un problema</div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">La pantalla se detuvo para evitar datos incorrectos</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Recarga la pagina e intenta nuevamente. Si vuelve a pasar, limpia la sesion local y carga el archivo otra vez.
            </p>
            <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-white">
              {this.state.error?.message || 'Error no identificado'}
            </pre>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                type="button"
                onClick={() => window.location.reload()}
              >
                Recargar
              </button>
              <button
                className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                type="button"
                onClick={this.clearLocalData}
              >
                Limpiar sesion local
              </button>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [activeUser, setActiveUser] = useState(null);

  useEffect(() => {
    try {
      const storedUser = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (storedUser) {
        setActiveUser(JSON.parse(storedUser));
      }
    } catch {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  function handleLogin(user) {
    setActiveUser(user);
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setActiveUser(null);
  }

  if (!activeUser) {
    return <LoginGate onLogin={handleLogin} />;
  }

  return (
    <AppErrorBoundary>
      <Dashboard activeUser={activeUser} onLogout={handleLogout} />
    </AppErrorBoundary>
  );
}
