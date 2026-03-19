import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { MoonStar, SunMedium } from 'lucide-react';

import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useTranslation } from '../hooks/useTranslation';
import { useToast } from '../utils/useToast';
import { useAuth, LOGIN_RETURN_KEY } from '../hooks/useAuth';

interface LoginProps {
  auth: ReturnType<typeof useAuth>;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
}

function GitHubIcon({ size = 25 }: { size?: number }) {
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 24 24" width={size}>
      <path
        d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.09-.744.084-.729.084-.729 1.205.084 1.84 1.236 1.84 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12z"
        fill="currentColor"
      />
    </svg>
  );
}

function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 48 48" width={size}>
      <path fill="#EA4335" d="M24 9.5c3.12 0 5.76 1.08 7.9 3.08l5.84-5.84C33.62 3.24 29.2 1 24 1 14.62 1 6.46 6.1 2.58 13.4l6.88 5.34C11.2 13.04 17.06 9.5 24 9.5z" />
      <path fill="#34A853" d="M46.5 24c0-1.66-.14-2.86-.46-4.1H24v7.76h12.94c-.26 2.06-1.66 5.16-4.78 7.24l7.34 5.68C43.62 36.78 46.5 31.02 46.5 24z" />
      <path fill="#4A90E2" d="M9.46 28.74A14.5 14.5 0 0 1 9 24c0-1.66.28-3.28.76-4.74l-6.88-5.34A23.93 23.93 0 0 0 1 24c0 3.86.92 7.5 2.58 10.68l6.88-5.34z" />
      <path fill="#FBBC05" d="M24 47c5.2 0 9.62-1.72 12.84-4.66l-7.34-5.68c-1.96 1.38-4.58 2.32-7.5 2.32-6.94 0-12.8-3.54-14.54-9.24l-6.88 5.34C6.46 41.9 14.62 47 24 47z" />
    </svg>
  );
}

function EmailIcon({ size = 25 }: { size?: number }) {
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 24 24" width={size}>
      <path
        d="M3.5 5.75h17a.75.75 0 0 1 .75.75v11a.75.75 0 0 1-.75.75h-17a.75.75 0 0 1-.75-.75v-11a.75.75 0 0 1 .75-.75zm16.25 2.2-7.46 4.62a.75.75 0 0 1-.78 0L4.25 7.95V17h15.5V7.95z"
        fill="currentColor"
      />
    </svg>
  );
}

const iconBtnCls =
  'inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95';

export default function Login({ auth, theme, onThemeToggle }: LoginProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const emailFormRef = useRef<HTMLDivElement>(null);

  const showGoogle = !!auth.googleLoginUrl;

  // Redirect away from login page once authenticated (e.g. after email polling succeeds)
  useEffect(() => {
    if (!auth.authenticated || auth.loading) return;
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
    navigate(target, { replace: true });
  }, [auth.authenticated, auth.loading, navigate]);

  // Handle error query params from backend redirects
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const error = params.get('error');
    if (!error) return;
    switch (error) {
      case 'pending':
        toast(t('messages.accountPending'), 'error');
        break;
      case 'rejected':
        toast(t('messages.accountRejected'), 'error');
        break;
      case 'not_registered':
        toast(t('messages.notRegistered'), 'error');
        break;
    }
    // Clear error param after showing toast.
    params.delete('error');
    setSearchParams(params, { replace: true });
  }, [location.search, setSearchParams, toast]);

  // Click outside email form to collapse (but keep email cached)
  useEffect(() => {
    if (!showEmailForm || emailSent || auth.emailPolling) return;
    const handler = (e: MouseEvent) => {
      if (emailFormRef.current && !emailFormRef.current.contains(e.target as Node)) {
        setShowEmailForm(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmailForm, emailSent, auth.emailPolling]);

  const handleEmailSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      toast(t('messages.emailRequired'), 'error');
      return;
    }
    try {
      setSending(true);
      await auth.requestEmailLogin(trimmed);
      toast(t('messages.loginLinkSent'), 'success');
      setEmailSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('messages.sendFailed');
      if (message.includes('user_not_registered')) {
        toast(t('messages.notRegistered'), 'error');
      } else if (message.includes('user_pending')) {
        toast(t('messages.accountPending'), 'error');
      } else if (message.includes('user_rejected')) {
        toast(t('messages.accountRejected'), 'error');
      } else {
        toast(message, 'error');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-xs text-[var(--text-main)]">
          {/* Top-right action buttons */}
          <div className="mb-0 mt-2 flex justify-end gap-0.5">
            <button
              aria-label={t('tooltips.githubRepo')}
              className={iconBtnCls}
              onClick={() => window.open('https://github.com/dieWehmut/story-timeline', '_blank')}
              type="button"
              title={t('tooltips.githubRepo')}
            >
              <GitHubIcon size={18} />
            </button>
            <LanguageSwitcher />
            <button
              aria-label={t('tooltips.themeSwitcher')}
              className={iconBtnCls}
              onClick={onThemeToggle}
              type="button"
            >
              {theme === 'dark' ? <SunMedium size={18} /> : <MoonStar size={18} />}
            </button>
          </div>

          {/* Title */}
          <h1 className="text-center text-2xl font-semibold">{t('auth.login')}</h1>

          {/* Login buttons */}
          <div className="mt-6 flex flex-col gap-3">
            <button
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-3 text-sm backdrop-blur-xl transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)]"
              onClick={() => auth.loginWith('github')}
              type="button"
            >
              <GitHubIcon size={20} />
              <span>{t('auth.loginWith.github')}</span>
            </button>

            {showGoogle && (
              <button
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-3 text-sm backdrop-blur-xl transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)]"
                onClick={() => auth.loginWith('google')}
                type="button"
              >
                <GoogleIcon size={20} />
                <span>{t('auth.loginWith.google')}</span>
              </button>
            )}

            {/* or divider */}
            <div className="flex items-center gap-1">
              <div className="h-px flex-1 bg-[var(--panel-border)]" />
              <span className="text-xs text-soft">{t('common.or')}</span>
              <div className="h-px flex-1 bg-[var(--panel-border)]" />
            </div>

            {/* Email: button or inline form */}
            {emailSent || auth.emailPolling ? (
              <div className="space-y-2 text-center">
                <div className="flex items-center justify-center gap-2 text-sm text-soft">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--text-accent)] border-t-transparent" />
                  {t('auth.waitingEmail')}
                </div>
                <p className="text-xs text-soft">{t('auth.checkEmail')}</p>
              </div>
            ) : (
              <div
                ref={emailFormRef}
                className={`flex h-[46px] cursor-pointer items-center rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 backdrop-blur-xl transition-all duration-300 hover:border-[var(--text-accent)] ${showEmailForm ? '' : 'justify-center'}`}
                onClick={() => { if (!showEmailForm) setShowEmailForm(true); }}
                role={showEmailForm ? undefined : 'button'}
              >
                <div className="flex items-center gap-3">
                  <EmailIcon size={25} />
                  <span
                    className="text-sm transition-all duration-300 whitespace-nowrap"
                    style={{
                      maxWidth: showEmailForm ? 0 : '12rem',
                      opacity: showEmailForm ? 0 : 1,
                      overflow: 'hidden',
                    }}
                  >
                    {t('auth.loginWith.email')}
                  </span>
                </div>
                <div
                  className="flex items-center gap-2 transition-all duration-300"
                  style={{
                    maxWidth: showEmailForm ? '20rem' : 0,
                    opacity: showEmailForm ? 1 : 0,
                    overflow: 'hidden',
                    marginLeft: showEmailForm ? '0.5rem' : 0,
                    flex: showEmailForm ? 1 : 0,
                  }}
                >
                  <input
                    className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-main)] outline-none placeholder:text-soft"
                    onChange={(event) => setEmail(event.target.value)}
                    onFocus={() => setShowEmailForm(true)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        void handleEmailSubmit();
                      }
                    }}
                    placeholder={t('auth.emailPlaceholder')}
                    ref={(el) => { if (el && showEmailForm) el.focus(); }}
                    type="email"
                    value={email}
                  />
                  <button
                    aria-label={t('auth.sendLoginLink')}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-main)] transition-all duration-300 hover:translate-x-1 hover:scale-110 hover:text-[var(--text-accent)] disabled:opacity-40"
                    disabled={sending}
                    onClick={(e) => { e.stopPropagation(); void handleEmailSubmit(); }}
                    type="button"
                  >
                    {sending ? (
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <svg aria-hidden="true" height={18} viewBox="0 0 24 24" width={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>



          {/* Switch to register */}
          <div className="mt-3">
            <button
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-3 text-sm backdrop-blur-xl transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)]"
              onClick={() => navigate('/register')}
              type="button"
            >
              <svg aria-hidden="true" height={20} viewBox="0 0 24 24" width={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
              <span>{t('auth.noAccount')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
