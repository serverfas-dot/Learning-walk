import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import PublicForm from './pages/PublicForm';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';

type Page = 'form' | 'login' | 'admin' | 'super-admin';

function getInitialPage(): Page {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'login') return 'login';
  if (hash === 'admin') return 'admin';
  if (hash === 'super-admin') return 'super-admin';
  return 'form';
}

function Router() {
  const { role, loading } = useAuth();
  const [page, setPage] = useState<Page>(getInitialPage());

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'login') setPage('login');
      else if (hash === 'admin') setPage('admin');
      else if (hash === 'super-admin') setPage('super-admin');
      else setPage('form');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function navigate(p: Page) {
    window.location.hash = p === 'form' ? '' : p;
    setPage(p);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (page === 'login') {
    return <Login onNavigate={navigate} />;
  }

  if (page === 'admin') {
    return <AdminDashboard onNavigate={navigate} />;
  }

  if (page === 'super-admin') {
    if (role !== 'super_admin') {
      return <Login onNavigate={navigate} redirectTo="super-admin" />;
    }
    return <SuperAdminDashboard onNavigate={navigate} />;
  }

  return <PublicForm onNavigate={navigate} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
