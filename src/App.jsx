import { useEffect, useState } from 'react';
import LoginGate from './components/LoginGate.jsx';
import Dashboard from './pages/Dashboard.jsx';

const SESSION_STORAGE_KEY = 'reas-active-user';

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

  return <Dashboard activeUser={activeUser} onLogout={handleLogout} />;
}
