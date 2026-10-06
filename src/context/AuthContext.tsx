import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AdminRole } from '../types';

export const SUPER_ADMIN_ID = 'superadmin';
export const SUPER_ADMIN_PASS = 'Admin@2026';

const SA_SESSION_KEY = 'sa_session';

interface AuthContextType {
  role: AdminRole;
  loading: boolean;
  superAdminLogin: (id: string, password: string) => { error: string | null };
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<AdminRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(SA_SESSION_KEY) === 'true') {
      setRole('super_admin');
    }
    setLoading(false);
  }, []);

  function superAdminLogin(id: string, password: string): { error: string | null } {
    if (id.trim() === SUPER_ADMIN_ID && password === SUPER_ADMIN_PASS) {
      localStorage.setItem(SA_SESSION_KEY, 'true');
      setRole('super_admin');
      return { error: null };
    }
    return { error: 'Incorrect ID or password.' };
  }

  function signOut() {
    localStorage.removeItem(SA_SESSION_KEY);
    setRole(null);
  }

  return (
    <AuthContext.Provider value={{ role, loading, superAdminLogin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
