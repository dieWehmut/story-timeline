import { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { api, API_BASE, API_BASE_FALLBACK } from '../lib/api';
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

const EMAIL_POLL_INTERVAL = 3000;
const EMAIL_POLL_TIMEOUT = 10 * 60 * 1000;
const APP_OAUTH_POLL_INTERVAL = 2000;
const APP_OAUTH_POLL_TIMEOUT = 10 * 60 * 1000;

export const useAuth = () => {
  const [session, setSession] = useState<AuthSession>(defaultSession);
  const [loading, setLoading] = useState(true);
  const [emailPolling, setEmailPolling] = useState(false);
  const pollRef = useRef<{ timer: ReturnType<typeof setInterval>; timeout: ReturnType<typeof setTimeout> } | null>(null);
  const appOAuthPollRef = useRef<{ timer: ReturnType<typeof setInterval>; timeout: ReturnType<typeof setTimeout> } | null>(null);

  const stopEmailPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current.timer);
      clearTimeout(pollRef.current.timeout);
      pollRef.current = null;
    }
    setEmailPolling(false);
  }, []);

  const stopAppOAuthPoll = useCallback(() => {
    if (appOAuthPollRef.current) {
      clearInterval(appOAuthPollRef.current.timer);
      clearTimeout(appOAuthPollRef.current.timeout);
      appOAuthPollRef.current = null;
    }
  }, []);

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

  // Legacy: handle email_token URL param (for old links still in circulation)
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
    let timer: ReturnType<typeof setTimeout> | null = null;

    const debouncedRefresh = () => {
      if (document.visibilityState !== 'visible') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void refreshSession();
      }, 300);
    };

    document.addEventListener('visibilitychange', debouncedRefresh);
    window.addEventListener('focus', debouncedRefresh);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', debouncedRefresh);
      window.removeEventListener('focus', debouncedRefresh);
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

        // Deep link succeeded — stop polling fallback
        stopAppOAuthPoll();

        try { await Browser.close(); } catch { /* browser may already be closed */ }

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

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      stopEmailPoll();
      stopAppOAuthPoll();
    };
  }, [stopEmailPoll, stopAppOAuthPoll]);

  const startEmailPoll = useCallback(
    (loginId: string) => {
      stopEmailPoll();
      setEmailPolling(true);

      const poll = async () => {
        try {
          const result = await api.pollEmailLogin(loginId);
          if (result.authenticated) {
            stopEmailPoll();
            const nextSession = await api.getSession();
            setSession(nextSession);
            setLoading(false);
          }
        } catch {
          // ignore poll errors, keep trying
        }
      };

      const timer = setInterval(() => { void poll(); }, EMAIL_POLL_INTERVAL);
      const timeout = setTimeout(() => { stopEmailPoll(); }, EMAIL_POLL_TIMEOUT);
      pollRef.current = { timer, timeout };
    },
    [stopEmailPoll]
  );

  const startAppOAuthPoll = useCallback(
    (nonce: string) => {
      stopAppOAuthPoll();

      const poll = async () => {
        try {
          const result = await api.pollAppOAuth(nonce);
          if (result.authenticated) {
            stopAppOAuthPoll();
            try { await Browser.close(); } catch { /* browser may already be closed */ }
            const nextSession = await api.getSession();
            setSession(nextSession);
            setLoading(false);
          }
        } catch {
          // ignore poll errors, keep trying
        }
      };

      const timer = setInterval(() => { void poll(); }, APP_OAUTH_POLL_INTERVAL);
      const timeout = setTimeout(() => { stopAppOAuthPoll(); }, APP_OAUTH_POLL_TIMEOUT);
      appOAuthPollRef.current = { timer, timeout };
    },
    [stopAppOAuthPoll]
  );

  const loginWith = (provider: 'github' | 'google') => {
    const isNative = Capacitor.isNativePlatform();
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (currentPath !== '/login' && currentPath !== '/register') {
      try {
        localStorage.setItem(LOGIN_RETURN_KEY, currentPath);
      } catch {
        // ignore storage errors
      }
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
        (isNative ? API_BASE_FALLBACK : '');
      const resolved = base ? new URL(raw, base) : new URL(raw);
      resolved.searchParams.set('return', currentPath);
      resolved.searchParams.set('client', isNative ? 'app' : 'web');

      // Generate nonce for app OAuth polling fallback
      let nonce = '';
      if (isNative) {
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        nonce = Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
        resolved.searchParams.set('nonce', nonce);
      }

      const target = resolved.toString();
      if (isNative) {
        void Browser.open({ url: target }).catch(() => window.location.assign(target));
        // Start polling as fallback in case deep link doesn't fire
        if (nonce) {
          startAppOAuthPoll(nonce);
        }
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
    if (currentPath !== '/login' && currentPath !== '/register') {
      try {
        localStorage.setItem(LOGIN_RETURN_KEY, currentPath);
      } catch {
        // ignore storage errors
      }
    }

    const endpoint = session.emailLoginUrl || `${API_BASE}/api/auth/email/login`;
    const result = await api.requestEmailLogin(email, endpoint, { returnTo: currentPath, client: isNative ? 'app' : 'web' });

    if (result.loginId) {
      startEmailPoll(result.loginId);
    }
  };

  const logout = async () => {
    stopEmailPoll();
    stopAppOAuthPoll();
    await api.logout();
    setSession(defaultSession);
  };

  return {
    ...session,
    loading,
    emailPolling,
    login,
    loginWith,
    requestEmailLogin,
    stopEmailPoll,
    logout,
  };
};
