import { useEffect, useState } from 'react';
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

export default function AuthEmail() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token') ?? '';
    const returnTo = sanitizeReturn(searchParams.get('return'));
    if (!token) {
      setError('登录链接已失效，请重新发送邮件');
      return;
    }

    const run = async () => {
      try {
        await api.exchangeEmailLogin(token);
        window.location.replace(returnTo || '/');
      } catch (err) {
        const message = err instanceof Error ? err.message : '登录失败，请重试';
        setError(message);
      }
    };

    void run();
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] px-6 text-center text-[var(--text-main)]">
      <div className="max-w-sm space-y-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-6 py-8 shadow-xl">
        <p className="text-base font-semibold">{error ? '登录失败' : '正在登录...'}</p>
        <p className="text-sm text-soft">
          {error ? error : '请稍候，我们正在为你打开物语集喵。'}
        </p>
        {error ? (
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
