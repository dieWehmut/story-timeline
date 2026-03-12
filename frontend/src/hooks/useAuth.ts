import { useEffect, useState } from 'react';
import { api, API_BASE } from '../lib/api';
import type { AuthSession } from '../types/image';

const defaultSession: AuthSession = {
  authenticated: false,
  loginUrl: `${API_BASE}/api/auth/github/login`,
  googleLoginUrl: `${API_BASE}/api/auth/google/login`,
  emailLoginUrl: '',
  isAdmin: false,
  canPost: false,
  roleLabel: '游客',
  user: null,
};

export const LOGIN_RETURN_KEY = 'story_login_return';

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

  const loginWith = (provider: 'github' | 'google') => {
    try {
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      localStorage.setItem(LOGIN_RETURN_KEY, currentPath);
    } catch {
      // ignore storage errors
    }

    const raw =
      provider === 'google'
        ? session.googleLoginUrl || `${API_BASE}/api/auth/google/login`
        : session.loginUrl || `${API_BASE}/api/auth/github/login`;
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

  const login = () => loginWith('github');

  const requestEmailLogin = async (email: string) => {
    try {
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      localStorage.setItem(LOGIN_RETURN_KEY, currentPath);
    } catch {
      // ignore storage errors
    }

    const endpoint = session.emailLoginUrl || `${API_BASE}/api/auth/email/login`;
    await api.requestEmailLogin(email, endpoint);
  };

  const logout = async () => {
    await api.logout();
    setSession(defaultSession);
  };

  return {
    ...session,
    loading,
    login,
    loginWith,
    requestEmailLogin,
    logout,
  };
};
