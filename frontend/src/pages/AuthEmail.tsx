import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

const sanitizeReturn = (value: string | null) => {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('/')) return '';
  if (trimmed.startsWith('//')) return '';
  if (trimmed.includes('://')) return '';
  return trimmed;
};

const buildReturnUrl = (path: string, token: string) => {
  const base = path || '/';
  try {
    const url = new URL(base, window.location.origin);
    url.searchParams.set('email_token', token);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}email_token=${encodeURIComponent(token)}`;
  }
};

const buildAppLink = (scheme: string, token: string, returnTo: string) => {
  const normalized = scheme.replace('://', '');
  const params = new URLSearchParams();
  params.set('token', token);
  if (returnTo) params.set('return', returnTo);
  return `${normalized}://auth/email?${params.toString()}`;
};

export default function AuthEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const token = searchParams.get('token') ?? '';
  const returnTo = sanitizeReturn(searchParams.get('return'));
  const client = (searchParams.get('client') ?? '').trim();
  const appScheme = (searchParams.get('appScheme') ?? '').trim();

  const returnUrl = useMemo(() => (token ? buildReturnUrl(returnTo || '/', token) : ''), [returnTo, token]);
  const appLink = useMemo(() => {
    if (!token || !appScheme) return '';
    return buildAppLink(appScheme, token, returnTo);
  }, [appScheme, returnTo, token]);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('登录链接已失效，请重新发送邮件。');
      return;
    }

    const run = async () => {
      try {
        await api.verifyEmailLogin(token);
        setStatus('success');
      } catch (err) {
        const nextMessage = err instanceof Error ? err.message : '登录失败，请重试。';
        setStatus('error');
        setMessage(nextMessage);
      }
    };

    void run();
  }, [token]);

  const title = status === 'loading' ? '正在确认登录...' : status === 'success' ? '已登录喵' : '登录失败';
  const detail =
    status === 'loading'
      ? '请稍候，我们正在为你确认登录。'
      : status === 'success'
        ? '请返回原页面 / App 继续使用。'
        : message;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] px-6 text-center text-[var(--text-main)]">
      <div className="max-w-sm space-y-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-6 py-8 shadow-xl">
        <p className="text-base font-semibold">{title}</p>
        <p className="text-sm text-soft">{detail}</p>
        {status === 'success' ? (
          <div className="mt-2 flex flex-col gap-2">
            <button
              className="rounded-full border border-[var(--panel-border)] px-4 py-2 text-sm transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)]"
              onClick={() => window.location.assign(returnUrl || '/')}
              type="button"
            >
              返回原页面
            </button>
            {client === 'app' && appLink ? (
              <button
                className="rounded-full border border-[var(--panel-border)] px-4 py-2 text-sm transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)]"
                onClick={() => window.location.assign(appLink)}
                type="button"
              >
                打开 App
              </button>
            ) : null}
          </div>
        ) : null}
        {status === 'error' ? (
          <button
            className="mt-2 rounded-full border border-[var(--panel-border)] px-4 py-2 text-sm transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)]"
            onClick={() => window.location.assign('/')}
            type="button"
          >
            返回首页
          </button>
        ) : null}
      </div>
    </div>
  );
}
