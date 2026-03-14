import { useCallback, useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { api, API_BASE, HF_SPACE_FALLBACK } from '../lib/api';
import type { AuthSession } from '../types/image';
import { subscribeAuthRefresh } from '../utils/authEvents';

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

  const refreshSession = useCallback(async () => {
    try {
      const nextSession = await api.getSession();
      setSession(nextSession);
      setLoading(false);
    } catch {
      // ignore refresh errors
    }
  }, []);

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
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('email_token');
    if (!token) return;

    const run = async () => {
      try {
        await api.exchangeEmailLogin(token, '/api/auth/email/exchange');
        const nextSession = await api.getSession();
        setSession(nextSession);
        setLoading(false);
      } catch {
        // ignore token exchange errors
      } finally {
        params.delete('email_token');
        const search = params.toString();
        const nextUrl = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
        window.history.replaceState(null, '', nextUrl);
      }
    };

    void run();
  }, []);

  useEffect(() => {
    const cleanup = subscribeAuthRefresh(() => {
      void refreshSession();
    });

    return cleanup;
  }, [refreshSession]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [refreshSession]);

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

    try {
      const origin = window.location.origin;
      const hasHttpOrigin = origin.startsWith('http://') || origin.startsWith('https://');
      const base =
        API_BASE ||
        (hasHttpOrigin ? origin : '') ||
        (isNative ? HF_SPACE_FALLBACK : '');
      const resolved = base ? new URL(raw, base) : new URL(raw);
      resolved.searchParams.set('return', currentPath);
      resolved.searchParams.set('client', isNative ? 'app' : 'web');
      const target = resolved.toString();
      if (isNative) {
        void Browser.open({ url: target }).catch(() => window.location.assign(target));
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
