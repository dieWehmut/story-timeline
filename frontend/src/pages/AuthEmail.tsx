import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { broadcastAuthRefresh } from '../utils/authEvents';
import { LOGIN_RETURN_KEY } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';

const sanitizeReturn = (value: string | null) => {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('/')) return '';
  if (trimmed.startsWith('//')) return '';
  if (trimmed.includes('://')) return '';
  return trimmed;
};

const buildAppLink = (scheme: string, token: string, returnTo: string) => {
  const normalized = scheme.replace('://', '');
  const params = new URLSearchParams();
  params.set('token', token);
  if (returnTo) params.set('return', returnTo);
  return `${normalized}://auth/email?${params.toString()}`;
};

export default function AuthEmail() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const token = searchParams.get('token') ?? '';
  const returnTo = sanitizeReturn(searchParams.get('return'));
  const client = (searchParams.get('client') ?? '').trim();
  const appScheme = (searchParams.get('appScheme') ?? '').trim();

  const appLink = useMemo(() => {
    if (!token || !appScheme) return '';
    return buildAppLink(appScheme, token, returnTo);
  }, [appScheme, returnTo, token]);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage(t('authEmail.invalidLink'));
      return;
    }

    const run = async () => {
      try {
        await api.confirmEmailLogin(token);
        setStatus('success');

        // Broadcast auth refresh to notify other tabs
        broadcastAuthRefresh();

        // Handle redirection after successful login
        setTimeout(() => {
          let target = '/';
          try {
            const saved = localStorage.getItem(LOGIN_RETURN_KEY);
            if (saved && saved.startsWith('/') && !saved.startsWith('//')) {
              target = saved;
              localStorage.removeItem(LOGIN_RETURN_KEY);
            }
          } catch {
            // ignore storage errors
          }

          // If this is for the app client, don't redirect automatically
          if (client !== 'app') {
            navigate(target, { replace: true });
          }
        }, 2000); // Give user a moment to see success message

      } catch (err) {
        const nextMessage = err instanceof Error ? err.message : t('authEmail.loginFailed');
        setStatus('error');
        setMessage(nextMessage);
      }
    };

    void run();
  }, [token, client, navigate, t]);

  const title = status === 'loading' ? t('authEmail.confirmingTitle') : status === 'success' ? t('authEmail.successTitle') : t('authEmail.errorTitle');
  const detail =
    status === 'loading'
      ? t('authEmail.confirmingDetail')
      : status === 'success'
        ? client === 'app'
          ? t('authEmail.successDetailApp')
          : t('authEmail.successDetailWeb')
        : message;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] px-6 text-center text-[var(--text-main)]">
      <div className="max-w-sm space-y-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-6 py-8 shadow-xl">
        <p className="text-base font-semibold">{title}</p>
        <p className="text-sm text-soft">{detail}</p>
        {status === 'success' && client === 'app' && appLink ? (
          <div className="mt-2 flex flex-col gap-2">
            <button
              className="rounded-full border border-[var(--panel-border)] px-4 py-2 text-sm transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)]"
              onClick={() => window.location.assign(appLink)}
              type="button"
            >
              {t('common.openApp')}
            </button>
          </div>
        ) : null}
        {status === 'error' ? (
          <button
            className="mt-2 rounded-full border border-[var(--panel-border)] px-4 py-2 text-sm transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)]"
            onClick={() => window.location.assign('/')}
            type="button"
          >
            {t('nav.home')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
