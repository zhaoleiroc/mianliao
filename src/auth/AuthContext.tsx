// src/auth/AuthContext.tsx
// React context wrapping the auth state + login/logout actions.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthUser } from '../types/api';
import { fetchMe, login as apiLogin, logout as apiLogout } from '../api/auth';
import { clearStoredAuth, getStoredAuth } from '../api/client';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  hasRole: (...roles: AuthUser['roles']) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredAuth();
    if (!stored) {
      setLoading(false);
      return;
    }
    setUser(stored.user as AuthUser);
    // Verify token by calling /me; if it fails, clear
    fetchMe()
      .then((me) => setUser(me))
      .catch(() => {
        clearStoredAuth();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (username, password) => {
        const result = await apiLogin(username, password);
        setUser(result.user);
        return result.user;
      },
      logout: async () => {
        await apiLogout();
        setUser(null);
      },
      hasRole: (...roles) => {
        if (!user) return false;
        return user.roles.some((r) => roles.includes(r));
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
