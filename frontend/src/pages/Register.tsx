import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoonStar, SunMedium } from 'lucide-react';

import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useTranslation } from '../hooks/useTranslation';
import { useToast } from '../utils/useToast';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

interface RegisterProps {
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

function LoginIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 24 24" width={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}

function ArrowLeftIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 24 24" width={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

type RegisterMethod = 'github' | 'google' | 'email';

const iconBtnCls =
  'inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95';

const btnCls =
  'flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-3 text-sm backdrop-blur-xl transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)]';

const inputCls =
  'w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-2.5 text-sm text-[var(--text-main)] outline-none backdrop-blur-xl transition placeholder:text-soft focus:border-[var(--text-accent)]';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MethodIcon = ({ method, size = 25 }: { method: RegisterMethod; size?: number }) => {
  switch (method) {
    case 'github': return <GitHubIcon size={size} />;
    case 'google': return <GoogleIcon size={size} />;
    case 'email': return <EmailIcon size={size} />;
  }
};

export default function Register({ auth, theme, onThemeToggle }: RegisterProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [step, setStep] = useState<'choose' | 'form'>('choose');
  const [method, setMethod] = useState<RegisterMethod>('email');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [purpose, setPurpose] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const cachedCode = sessionStorage.getItem('invite_code') ?? '';
  const hasInviteFromLink = !!cachedCode;

  const chooseMethod = (m: RegisterMethod) => {
    setMethod(m);
    setStep('form');
  };

  const validate = (): boolean => {
    if (!username.trim()) {
      toast(t('messages.usernameRequired'), 'error');
      return false;
    }
    if (!email.trim()) {
      toast(t('messages.emailRequired'), 'error');
      return false;
    }
    if (!EMAIL_RE.test(email.trim())) {
      toast(t('messages.emailInvalid'), 'error');
      return false;
    }
    if ([...purpose.trim()].length < 10) {
      toast(t('messages.purposeTooShort'), 'error');
      return false;
    }
    if (!hasInviteFromLink && !inviteCode.trim()) {
      toast(t('messages.inviteCodeRequired'), 'error');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const code = hasInviteFromLink ? cachedCode : inviteCode.trim();

    try {
      setSubmitting(true);
      await api.register({
        username: username.trim(),
        email: email.trim(),
        purpose: purpose.trim(),
        inviteCode: code,
        registerMethod: method,
      });
      sessionStorage.removeItem('invite_code');

      if (method === 'github' || method === 'google') {
        toast(t('messages.registerSuccessOAuth'), 'success');
        setTimeout(() => auth.loginWith(method), 800);
      } else {
        toast(t('messages.registerSuccessEmail'), 'success');
        setTimeout(() => navigate('/login'), 1500);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '注册失败';
      if (message.includes('invite_code_invalid')) {
        toast(t('messages.inviteCodeRequired'), 'error');
      } else if (message.includes('email_already_registered')) {
        toast(t('messages.emailAlreadyRegistered'), 'error');
      } else {
        toast(message, 'error');
      }
    } finally {
      setSubmitting(false);
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
              onClick={() => window.open('https://github.com/story-timeline/story-timeline', '_blank')}
              type="button"
              title={t('tooltips.githubRepo')}
            >
              <GitHubIcon size={18} />
            </button>
            <LanguageSwitcher />
            <button aria-label={t('tooltips.themeSwitcher')} className={iconBtnCls} onClick={onThemeToggle} type="button">
              {theme === 'dark' ? <SunMedium size={18} /> : <MoonStar size={18} />}
            </button>
          </div>

          {/* Title */}
          <h1 className="text-center text-2xl font-semibold">{t('auth.register')}</h1>

          {step === 'choose' ? (
            <div key="choose" className="step-transition">
              {/* Step 1: choose register method */}
              <div className="mt-6 flex flex-col gap-3">
                <button className={btnCls} onClick={() => chooseMethod('github')} type="button">
                  <GitHubIcon size={20} />
                  <span>{t('auth.registerWith.github')}</span>
                </button>
                <button className={btnCls} onClick={() => chooseMethod('google')} type="button">
                  <GoogleIcon size={20} />
                  <span>{t('auth.registerWith.google')}</span>
                </button>

                <div className="flex items-center gap-1">
                  <div className="h-px flex-1 bg-[var(--panel-border)]" />
                  <span className="text-xs text-soft">{t('common.or')}</span>
                  <div className="h-px flex-1 bg-[var(--panel-border)]" />
                </div>

                <button className={btnCls} onClick={() => chooseMethod('email')} type="button">
                  <EmailIcon size={25} />
                  <span>{t('auth.registerWith.email')}</span>
                </button>
              </div>

              {/* Switch to login */}
              <div className="mt-3">
                <button className={btnCls} onClick={() => navigate('/login')} type="button">
                  <LoginIcon size={20} />
                  <span>{t('auth.hasAccount')}</span>
                </button>
              </div>
            </div>
          ) : (
            <div key="form" className="step-transition">
              {/* Step 2: form + submit */}

              {/* Form fields */}
              <div className="mt-4 flex flex-col gap-3">
                <input
                  className={inputCls}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('register.username')}
                  type="text"
                  value={username}
                />
                <input
                  className={inputCls}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('register.email')}
                  type="email"
                  value={email}
                />
                <textarea
                  className={`${inputCls} min-h-[80px] resize-none`}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder={t('register.purpose')}
                  rows={3}
                  value={purpose}
                />
                {!hasInviteFromLink && (
                  <input
                    className={inputCls}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder={t('register.inviteCode')}
                    type="text"
                    value={inviteCode}
                  />
                )}
              </div>

              {/* Submit button */}
              <div className="mt-4 flex flex-col gap-3">
                <button
                  className={`${btnCls} disabled:opacity-40`}
                  disabled={submitting}
                  onClick={() => void handleSubmit()}
                  type="button"
                >
                  {submitting ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <MethodIcon method={method} size={20} />
                  )}
                  <span>{t('register.submit')}</span>
                </button>

                {/* Back to choose method */}
                <button className={btnCls} onClick={() => setStep('choose')} type="button">
                  <ArrowLeftIcon size={16} />
                  <span>{t('register.backToMethod')}</span>
                </button>

                {/* Switch to login */}
                <button className={btnCls} onClick={() => navigate('/login')} type="button">
                  <LoginIcon size={20} />
                  <span>{t('auth.hasAccount')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
