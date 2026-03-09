import { useEffect, useState } from 'react';
import { api, API_BASE } from '../lib/api';
import type { AuthSession } from '../types/image';

const defaultSession: AuthSession = {
  authenticated: false,
  loginUrl: `${API_BASE}/api/auth/github/login`,
  user: null,
};

export const useAuth = () => {
  const [session, setSession] = useState<AuthSession>(defaultSession);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      try {
        const nextSession = await api.getSession();

        if (!cancelled) {
          setSession(nextSession);
        }
      } catch {
        if (!cancelled) {
          setSession(defaultSession);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = () => {
    const url = session.loginUrl || `${API_BASE}/api/auth/github/login`;
    window.location.href = url.startsWith('http') ? url : `${API_BASE}${url}`;
  };

  const logout = async () => {
    await api.logout();
    setSession(defaultSession);
  };

  return {
    ...session,
    loading,
    login,
    logout,
  };
};