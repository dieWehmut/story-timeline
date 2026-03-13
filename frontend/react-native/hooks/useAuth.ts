import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { api, API_BASE } from '@/lib/api';
import { storage } from '@/lib/storage';
import type { AuthSession } from '@/types/image';

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

  const loadSession = useCallback(async () => {
    try {
      const nextSession = await api.getSession();
      setSession(nextSession);
    } catch {
      setSession(defaultSession);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
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

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const loginWith = async (provider: 'github' | 'google') => {
    const raw =
      provider === 'google'
        ? session.googleLoginUrl || `${API_BASE}/api/auth/google/login`
        : session.loginUrl || `${API_BASE}/api/auth/github/login`;
    try {
      await storage.setItem(LOGIN_RETURN_KEY, 'story');
    } catch {
      // ignore storage errors
    }
    if (raw) {
      await Linking.openURL(raw);
    }
  };

  const login = () => loginWith('github');

  const requestEmailLogin = async (email: string) => {
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
    refresh: loadSession,
  };
};
