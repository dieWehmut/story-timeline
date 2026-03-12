import { useEffect, useState } from 'react';
import { api, API_BASE } from '../lib/api';
import type { AuthSession } from '../types/image';

const defaultSession: AuthSession = {
  authenticated: false,
  loginUrl: `${API_BASE}/api/auth/github/login`,
  isAdmin: false,
  canPost: false,
  roleLabel: '游客',
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
    const raw = session.loginUrl || `${API_BASE}/api/auth/github/login`;
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      window.location.assign(raw);
      return;
    }
    const base = API_BASE || window.location.origin;
    try {
      const resolved = new URL(raw, base).toString();
      window.location.assign(resolved);
    } catch {
      window.location.assign(raw);
    }
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
