import { useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { api, API_BASE } from '../lib/api';
import type { AuthSession } from '../types/image';

const defaultSession: AuthSession = {
  authenticated: false,
  loginUrl: `${API_BASE}/api/auth/github/login`,
  googleLoginUrl: `${API_BASE}/api/auth/google/login`,
  emailLoginUrl: '',
  isAdmin: false,
  canPost: false,
  roleLabel: '??',
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

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    const handler = async (event: { url: string }) => {
      try {
        const parsed = new URL(event.url);
        const combinedPath = parsed.hostname ? `/${parsed.hostname}${parsed.pathname}` : parsed.pathname;
        const token = parsed.searchParams.get('token') ?? '';
        if (!token) return;

        const returnTo = parsed.searchParams.get('return') ?? '';
        if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
          try {
            localStorage.setItem(LOGIN_RETURN_KEY, returnTo);
          } catch {
            // ignore storage errors
          }
        }

        if (combinedPath.startsWith('/auth/email')) {
          await api.exchangeEmailLogin(token);
        } else if (combinedPath.startsWith('/auth/callback')) {
          await api.exchangeSession(token);
        } else {
          return;
        }

        const nextSession = await api.getSession();
        setSession(nextSession);
        setLoading(false);
      } catch {
        // ignore deep link errors
      }
    };

    let removeListener: (() => void) | undefined;
    void (async () => {
      const handle = await CapacitorApp.addListener('appUrlOpen', handler);
      removeListener = () => {
        void handle.remove();
      };
    })();

    return () => {
      if (removeListener) removeListener();
    };
  }, []);

  const loginWith = (provider: 'github' | 'google') => {
    const isNative = Capacitor.isNativePlatform();
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    try {
      localStorage.setItem(LOGIN_RETURN_KEY, currentPath);
    } catch {
      // ignore storage errors
    }

    const raw =
      provider === 'google'
        ? session.googleLoginUrl || `${API_BASE}/api/auth/google/login`
        : session.loginUrl || `${API_BASE}/api/auth/github/login`;

    const base = API_BASE || window.location.origin;
    try {
      const resolved = new URL(raw, base);
      resolved.searchParams.set('return', currentPath);
      resolved.searchParams.set('client', isNative ? 'app' : 'web');
      const target = resolved.toString();
      if (isNative) {
        void Browser.open({ url: target });
        return;
      }
      window.location.assign(target);
    } catch {
      if (isNative) {
        void Browser.open({ url: raw });
        return;
      }
      window.location.assign(raw);
    }
  };

  const login = () => loginWith('github');

  const requestEmailLogin = async (email: string) => {
    const isNative = Capacitor.isNativePlatform();
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    try {
      localStorage.setItem(LOGIN_RETURN_KEY, currentPath);
    } catch {
      // ignore storage errors
    }

    const endpoint = session.emailLoginUrl || `${API_BASE}/api/auth/email/login`;
    await api.requestEmailLogin(email, endpoint, { returnTo: currentPath, client: isNative ? 'app' : 'web' });
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
