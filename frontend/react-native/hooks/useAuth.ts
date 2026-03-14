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

const appendQuery = (url: string, params: Record<string, string>) => {
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  if (!query) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${query}`;
};

const resolveAuthUrl = (raw: string, returnTo: string) => {
  if (!raw) return '';
  const base = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `${API_BASE}${raw}`;
  return appendQuery(base, { return: returnTo, client: 'app' });
};

const parseQuery = (query: string) => {
  const params: Record<string, string> = {};
  query.split('&').forEach((part) => {
    if (!part) return;
    const [rawKey, rawValue = ''] = part.split('=');
    if (!rawKey) return;
    params[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue);
  });
  return params;
};

const parseAuthLink = (url: string) => {
  const [noHash] = url.split('#');
  const [pathPart, queryPart = ''] = noHash.split('?');
  const withoutScheme = pathPart.replace(/^[a-z]+:\/\//i, '');
  const combinedPath = withoutScheme.startsWith('/') ? withoutScheme : `/${withoutScheme}`;
  const params = parseQuery(queryPart);
  return { combinedPath, params };
};

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

  useEffect(() => {
    const handleUrl = async (url: string) => {
      try {
        const { combinedPath, params } = parseAuthLink(url);
        const token = params.token || params.email_token || '';
        if (!token) return;

        if (combinedPath.startsWith('/auth/email')) {
          await api.exchangeEmailLogin(token);
        } else if (combinedPath.startsWith('/auth/callback')) {
          await api.exchangeSession(token);
        } else {
          return;
        }

        await loadSession();
      } catch {
        // ignore deep link errors
      }
    };

    const subscription = Linking.addEventListener('url', (event) => {
      void handleUrl(event.url);
    });

    void (async () => {
      const initial = await Linking.getInitialURL();
      if (initial) {
        await handleUrl(initial);
      }
    })();

    return () => {
      subscription.remove();
    };
  }, [loadSession]);

  const loginWith = async (provider: 'github' | 'google') => {
    const raw =
      provider === 'google'
        ? session.googleLoginUrl || `${API_BASE}/api/auth/google/login`
        : session.loginUrl || `${API_BASE}/api/auth/github/login`;
    const target = resolveAuthUrl(raw, '/');
    try {
      await storage.setItem(LOGIN_RETURN_KEY, 'story');
    } catch {
      // ignore storage errors
    }
    if (target) {
      await Linking.openURL(target);
    }
  };

  const login = () => loginWith('github');

  const requestEmailLogin = async (email: string) => {
    const endpoint = session.emailLoginUrl || `${API_BASE}/api/auth/email/login`;
    await api.requestEmailLogin(email, endpoint, { returnTo: '/', client: 'app' });
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
