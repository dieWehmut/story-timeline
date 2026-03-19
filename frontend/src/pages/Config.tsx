import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Copy, Link, RefreshCw, Trash2 } from 'lucide-react';
import { HomeButton } from '../layouts/HomeButton';
import { ThemeButton } from '../layouts/ThemeButton';
import { useProfile } from '../context/ProfileContext';
import { useLanguage, type Language } from '../context/LanguageContext';
import { useTranslation } from '../hooks/useTranslation';
import { api } from '../lib/api';
import { useToast } from '../utils/useToast';
import { useAuth } from '../hooks/useAuth';
import { ConfirmModal } from '../ui/ConfirmModal';
import type { Identity } from '../types/image';

interface ConfigProps {
  auth: ReturnType<typeof useAuth>;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

const resizeImageToDataUrl = (file: File, maxSize = 128): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(src);
      const canvas = document.createElement('canvas');
      canvas.width = maxSize;
      canvas.height = maxSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas not supported')); return; }
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, maxSize, maxSize);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(src); reject(new Error('load failed')); };
    img.src = src;
  });

const btnCls =
  'rounded-full border border-[var(--panel-border)] px-2.5 py-1 text-[10px] transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)] disabled:opacity-40';

const iconBtnCls =
  'inline-flex h-6 w-6 items-center justify-center rounded-md border border-[var(--panel-border)] text-soft transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)] disabled:opacity-40';

function InviteCodeSection() {
  const [code, setCode] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ttlDays, setTtlDays] = useState(0);
  const [copied, setCopied] = useState<'code' | 'link' | false>(false);

  const fetchCode = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getInviteCode();
      setCode(res.code || '');
      setExpiresAt(res.expiresAt || '');
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchCode(); }, [fetchCode]);

  const handleGenerate = async () => {
    try {
      setBusy(true);
      const ttlSeconds = ttlDays > 0 ? ttlDays * 86400 : 0;
      const res = await api.generateInviteCode(ttlSeconds);
      setCode(res.code || '');
      setExpiresAt(res.expiresAt || '');
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    try {
      setBusy(true);
      await api.deleteInviteCode();
      setCode('');
      setExpiresAt('');
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied('code');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const handleCopyLink = async () => {
    if (!code) return;
    try {
      const link = `${window.location.origin}/invites/${code}`;
      await navigator.clipboard.writeText(link);
      setCopied('link');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const formatExpiry = (iso: string) => {
    if (!iso) return '无限期';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '无限期';
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-3">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--text-accent)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {code ? (
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-black/20 px-2.5 py-1.5 font-mono text-xs text-[var(--text-accent)]">
            {code}
          </code>
          <button aria-label="复制邀请码" className={iconBtnCls} onClick={() => void handleCopy()} title="复制邀请码" type="button">
            <Copy size={12} />
          </button>
          <button aria-label="复制邀请链接" className={iconBtnCls} onClick={() => void handleCopyLink()} title="复制邀请链接" type="button">
            <Link size={12} />
          </button>
          <button aria-label="刷新" className={iconBtnCls} disabled={busy} onClick={() => void handleGenerate()} title="重新生成" type="button">
            <RefreshCw size={12} />
          </button>
          <button aria-label="删除" className={iconBtnCls} disabled={busy} onClick={() => void handleDelete()} title="删除" type="button">
            <Trash2 size={12} />
          </button>
        </div>
      ) : (
        <p className="text-[10px] text-soft">当前无有效邀请码</p>
      )}

      {code && (
        <p className="text-[10px] text-soft">
          {copied ? (copied === 'link' ? '邀请链接已复制!' : '邀请码已复制!') : `有效期: ${formatExpiry(expiresAt)}`}
        </p>
      )}

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-soft">有效期</span>
        <select
          aria-label="邀请码有效期"
          className="rounded-lg border border-[var(--panel-border)] bg-transparent px-2 py-1 text-[10px] text-[var(--text-main)] outline-none"
          disabled={busy}
          onChange={(e) => setTtlDays(Number(e.target.value))}
          value={ttlDays}
        >
          <option value={0}>无限期</option>
          <option value={1}>1 天</option>
          <option value={7}>7 天</option>
          <option value={30}>30 天</option>
        </select>
        {!code && (
          <button className={btnCls} disabled={busy} onClick={() => void handleGenerate()} type="button">
            生成邀请码
          </button>
        )}
      </div>
    </div>
  );
}

function AdminNotificationEmailSection() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [savedEmail, setSavedEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const res = await api.getAdminEmail();
        if (!cancelled) {
          setEmail(res.email || '');
          setSavedEmail(res.email || '');
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetch();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      toast('请输入邮箱', 'error');
      return;
    }
    try {
      setSaving(true);
      await api.setAdminEmail(trimmed);
      setSavedEmail(trimmed);
      toast('管理员邮箱已保存', 'success');
    } catch {
      toast('保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-3">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--text-accent)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <input
        className="mt-1.5 w-full rounded-lg border border-[var(--panel-border)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none transition focus:border-[var(--text-accent)]"
        onChange={(e) => setEmail(e.target.value)}
        placeholder="admin@example.com"
        type="email"
        value={email}
      />
      <div className="mt-1.5 flex items-center gap-1.5">
        <button className={btnCls} disabled={saving || email.trim() === savedEmail} onClick={() => void handleSave()} type="button">
          {saving ? '保存中..' : '保存'}
        </button>
        {savedEmail && <span className="text-[10px] text-soft">当前: {savedEmail}</span>}
      </div>
    </div>
  );
}

function GitHubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 24 24" width={size}>
      <path
        d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.09-.744.084-.729.084-.729 1.205.084 1.84 1.236 1.84 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12z"
        fill="currentColor"
      />
    </svg>
  );
}

function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 48 48" width={size}>
      <path fill="#EA4335" d="M24 9.5c3.12 0 5.76 1.08 7.9 3.08l5.84-5.84C33.62 3.24 29.2 1 24 1 14.62 1 6.46 6.1 2.58 13.4l6.88 5.34C11.2 13.04 17.06 9.5 24 9.5z" />
      <path fill="#34A853" d="M46.5 24c0-1.66-.14-2.86-.46-4.1H24v7.76h12.94c-.26 2.06-1.66 5.16-4.78 7.24l7.34 5.68C43.62 36.78 46.5 31.02 46.5 24z" />
      <path fill="#4A90E2" d="M9.46 28.74A14.5 14.5 0 0 1 9 24c0-1.66.28-3.28.76-4.74l-6.88-5.34A23.93 23.93 0 0 0 1 24c0 3.86.92 7.5 2.58 10.68l6.88-5.34z" />
      <path fill="#FBBC05" d="M24 47c5.2 0 9.62-1.72 12.84-4.66l-7.34-5.68c-1.96 1.38-4.58 2.32-7.5 2.32-6.94 0-12.8-3.54-14.54-9.24l-6.88 5.34C6.46 41.9 14.62 47 24 47z" />
    </svg>
  );
}

function EmailIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 24 24" width={size}>
      <path
        d="M3.5 5.75h17a.75.75 0 0 1 .75.75v11a.75.75 0 0 1-.75.75h-17a.75.75 0 0 1-.75-.75v-11a.75.75 0 0 1 .75-.75zm16.25 2.2-7.46 4.62a.75.75 0 0 1-.78 0L4.25 7.95V17h15.5V7.95z"
        fill="currentColor"
      />
    </svg>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AccountBindingSection() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loading, setLoading] = useState(true);
  const [bindingInProgress, setBingingInProgress] = useState<string | null>(null);
  const [emailBindInput, setEmailBindInput] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [unbindConfirm, setUnbindConfirm] = useState<string | null>(null);
  const emailFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchIdentities = async () => {
      try {
        const res = await api.getIdentities();
        setIdentities(res.identities || []);
      } catch (err) {
        console.error('Failed to fetch identities:', err);
      } finally {
        setLoading(false);
      }
    };
    void fetchIdentities();
  }, []);

  // Click outside email form to collapse
  useEffect(() => {
    if (!showEmailInput) return;
    const handler = (e: MouseEvent) => {
      if (emailFormRef.current && !emailFormRef.current.contains(e.target as Node)) {
        setShowEmailInput(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmailInput]);

  const handleBind = async (targetProvider: string) => {
    if (bindingInProgress) return;

    try {
      setBingingInProgress(targetProvider);

      if (targetProvider === 'github') {
        const res = await api.startBindGitHub();
        window.location.href = res.url;
      } else if (targetProvider === 'google') {
        const res = await api.startBindGoogle();
        window.location.href = res.url;
      } else if (targetProvider === 'email') {
        setShowEmailInput(true);
        setBingingInProgress(null);
      }
    } catch {
      toast(t('messages.bindFailed'), 'error');
      setBingingInProgress(null);
    }
  };

  const handleEmailBind = async () => {
    const email = emailBindInput.trim();
    if (!email) {
      toast(t('messages.emailRequired'), 'error');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      toast(t('messages.invalidEmail'), 'error');
      return;
    }

    try {
      setBingingInProgress('email');
      await api.bindEmail(email);
      toast(t('messages.verificationEmailSent'), 'success');
      setShowEmailInput(false);
      setEmailBindInput('');
    } catch (err) {
      const message = err instanceof Error ? err.message : t('messages.bindFailed');
      if (message.includes('email_already_bound')) {
        toast(t('messages.emailAlreadyBound'), 'error');
      } else {
        toast(message, 'error');
      }
    } finally {
      setBingingInProgress(null);
    }
  };

  const handleUnbind = (targetProvider: string) => {
    if (identities.length <= 1) {
      toast(t('messages.cannotUnbindOnly'), 'error');
      return;
    }

    setUnbindConfirm(targetProvider);
  };

  const confirmUnbind = async () => {
    if (!unbindConfirm) return;

    try {
      await api.unbindProvider(unbindConfirm);
      setIdentities(identities.filter(id => id.provider !== unbindConfirm));
      toast(t('messages.unbindSuccess'), 'success');
    } catch {
      toast(t('messages.unbindFailed'), 'error');
    } finally {
      setUnbindConfirm(null);
    }
  };

  const getProviderIcon = (prov: string) => {
    switch (prov) {
      case 'github': return <GitHubIcon size={20} />;
      case 'google': return <GoogleIcon size={20} />;
      case 'email': return <EmailIcon size={25} />;
      default: return null;
    }
  };

  const getIdentityDisplayName = (identity: Identity) => {
    // For GitHub: prefer displayName (username), fallback to providerId
    if (identity.provider === 'github') {
      return identity.displayName || identity.providerId || 'GitHub';
    }
    // For Google: prefer email, fallback to displayName or providerId
    if (identity.provider === 'google') {
      return identity.email || identity.displayName || identity.providerId || 'Google';
    }
    // For email provider: show email
    if (identity.provider === 'email') {
      return identity.email || identity.providerId || 'Email';
    }
    // Fallback for any other provider
    return identity.displayName || identity.email || identity.providerId || identity.provider;
  };

  const getProviderLabel = (prov: string) => {
    switch (prov) {
      case 'github': return 'GitHub';
      case 'google': return 'Google';
      case 'email': return t('settings.email');
      default: return prov;
    }
  };

  const isBound = (prov: string) => identities.some(id => id.provider === prov);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-3">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--text-accent)] border-t-transparent" />
      </div>
    );
  }

  const emailIdentity = identities.find(id => id.provider === 'email');
  const oauthProviders = ['github', 'google'];

  return (
    <div className="space-y-3">
      {/* Email row - show if email is bound */}
      {emailIdentity && (
        <div className="flex h-[46px] items-center rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <EmailIcon size={25} />
            <span className="text-sm">{emailIdentity.email || t('settings.noEmailBound')}</span>
          </div>
        </div>
      )}

      {/* OAuth providers - GitHub and Google */}
      {oauthProviders.map(targetProvider => {
        const bound = isBound(targetProvider);
        const identity = identities.find(id => id.provider === targetProvider);

        if (bound && identity) {
          // Show bound state with actual name
          return (
            <div
              key={targetProvider}
              className="flex h-[46px] items-center justify-between rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 backdrop-blur-xl"
            >
              <div className="flex items-center gap-3">
                {getProviderIcon(targetProvider)}
                <span className="text-sm">{getIdentityDisplayName(identity)}</span>
              </div>
              <button
                className="text-xs text-soft transition hover:text-[var(--text-accent)]"
                disabled={identities.length <= 1}
                onClick={() => void handleUnbind(targetProvider)}
                title={identities.length <= 1 ? t('messages.cannotUnbindOnly') : ''}
                type="button"
              >
                {t('settings.unbind')}
              </button>
            </div>
          );
        }

        // Show unbound state - clickable to bind
        return (
          <button
            key={targetProvider}
            className="flex h-[46px] w-full items-center justify-center gap-3 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 text-sm backdrop-blur-xl transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)] disabled:opacity-40"
            disabled={bindingInProgress === targetProvider}
            onClick={() => void handleBind(targetProvider)}
            type="button"
          >
            {getProviderIcon(targetProvider)}
            <span>
              {bindingInProgress === targetProvider
                ? t('settings.binding')
                : `${t('settings.bind')} ${getProviderLabel(targetProvider)}`}
            </span>
          </button>
        );
      })}

      {/* Email binding - expandable like Login.tsx */}
      {!emailIdentity && (
        <div
          ref={emailFormRef}
          className={`flex h-[46px] cursor-pointer items-center rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 backdrop-blur-xl transition-all duration-300 hover:border-[var(--text-accent)] ${showEmailInput ? '' : 'justify-center'}`}
          onClick={() => { if (!showEmailInput) setShowEmailInput(true); }}
          {...(!showEmailInput && { role: 'button' })}
        >
          <div className="flex items-center gap-3">
            <EmailIcon size={25} />
            <span
              className="text-sm transition-all duration-300 whitespace-nowrap"
              style={{
                maxWidth: showEmailInput ? 0 : '12rem',
                opacity: showEmailInput ? 0 : 1,
                overflow: 'hidden',
              }}
            >
              {t('settings.bindEmail')}
            </span>
          </div>
          <div
            className="flex items-center gap-2 transition-all duration-300"
            style={{
              maxWidth: showEmailInput ? '20rem' : 0,
              opacity: showEmailInput ? 1 : 0,
              overflow: 'hidden',
              marginLeft: showEmailInput ? '0.5rem' : 0,
              flex: showEmailInput ? 1 : 0,
            }}
          >
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-main)] outline-none placeholder:text-soft"
              onChange={(event) => setEmailBindInput(event.target.value)}
              onFocus={() => setShowEmailInput(true)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleEmailBind();
                }
              }}
              placeholder={t('auth.emailPlaceholder')}
              ref={(el) => { if (el && showEmailInput) el.focus(); }}
              type="email"
              value={emailBindInput}
            />
            <button
              aria-label={t('settings.sendVerification')}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-main)] transition-all duration-300 hover:translate-x-1 hover:scale-110 hover:text-[var(--text-accent)] disabled:opacity-40"
              disabled={bindingInProgress === 'email'}
              onClick={(e) => { e.stopPropagation(); void handleEmailBind(); }}
              type="button"
            >
              {bindingInProgress === 'email' ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <svg aria-hidden="true" height={18} viewBox="0 0 24 24" width={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Unbind confirmation modal */}
      <ConfirmModal
        open={!!unbindConfirm}
        title={t('settings.confirmUnbind')}
        message={t('settings.unbindWarning', { provider: getProviderLabel(unbindConfirm || '') })}
        confirmText={t('settings.confirmUnbindBtn')}
        cancelText={t('common.cancel')}
        onConfirm={confirmUnbind}
        onCancel={() => setUnbindConfirm(null)}
      />
    </div>
  );
}

function LanguageSection() {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();

  const languages: { code: Language; name: string }[] = [
    { code: 'zh-CN', name: t('languages.zh-CN') },
    { code: 'zh-TW', name: t('languages.zh-TW') },
    { code: 'en', name: t('languages.en') },
    { code: 'ja', name: t('languages.ja') },
    { code: 'de', name: t('languages.de') },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {languages.map((lang) => (
        <button
          key={lang.code}
          className={`rounded-full border px-3 py-1.5 text-xs transition ${
            language === lang.code
              ? 'border-[var(--text-accent)] text-[var(--text-accent)]'
              : 'border-[var(--panel-border)] text-[var(--text-main)] hover:border-[var(--text-accent)] hover:text-[var(--text-accent)]'
          }`}
          onClick={() => setLanguage(lang.code)}
          type="button"
        >
          {lang.name}
        </button>
      ))}
    </div>
  );
}

export default function Config({ auth, theme, onThemeToggle }: ConfigProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { t } = useTranslation();
  const {
    user,
    displayName,
    displayAvatar,
    backgroundImage,
    backgroundOpacity,
    currentDisplayName,
    currentAvatar,
    setDisplayName,
    setDisplayAvatar,
    resetDisplayName,
    resetDisplayAvatar,
    setBackgroundImage,
    resetBackgroundImage,
    setBackgroundOpacity,
  } = useProfile();
  const [nameInput, setNameInput] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNameInput(displayName || user?.login || '');
  }, [displayName, user?.login]);

  // Handle bind callback query params
  useEffect(() => {
    const bind = searchParams.get('bind');
    const error = searchParams.get('error');

    if (bind === 'success') {
      toast(t('messages.bindSuccess'), 'success');
    } else if (bind === 'already') {
      toast(t('messages.alreadyBound'), 'info');
    } else if (error) {
      switch (error) {
        case 'invalid_state':
          toast(t('messages.bindFailedInvalidState'), 'error');
          break;
        case 'oauth_failed':
          toast(t('messages.bindFailedOAuth'), 'error');
          break;
        case 'already_bound':
          toast(t('messages.emailAlreadyBound'), 'error');
          break;
        case 'bind_failed':
          toast(t('messages.bindFailed'), 'error');
          break;
        default:
          toast(`${t('messages.bindFailed')}：${error}`, 'error');
      }
    }

    // Clear query params
    if (bind || error) {
      searchParams.delete('bind');
      searchParams.delete('error');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, toast, t]);

  const avatarPreview = displayAvatar || currentAvatar;
  const bgPreview = backgroundImage;
  const nameDisabled = !user;
  const avatarDisabled = !user;

  const handleAvatarFile = async (file?: File | null) => {
    if (!file || avatarDisabled) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      void setDisplayAvatar(dataUrl);
    } catch {
      // ignore
    }
  };

  const handleBackgroundFile = async (file?: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await readAsDataUrl(file);
      setBackgroundImage(dataUrl);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-base)]">
      <header className="fixed left-0 right-0 top-0 z-40 bg-[var(--panel-bg)] px-3 pt-3 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <button
            aria-label={t('common.back')}
            className="inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition hover:text-[var(--text-accent)] active:scale-95"
            onClick={() => navigate(-1)}
            type="button"
          >
            <ArrowLeft size={22} />
          </button>

          <div className="flex flex-1 flex-col items-center">
            <p className="text-base font-semibold text-[var(--text-main)]">{t('settings.title')}</p>
          </div>

          <div className="flex items-center -space-x-1">
            <HomeButton />
            <ThemeButton onToggle={onThemeToggle} theme={theme} />
          </div>
        </div>
      </header>

      <div className="flex flex-1 items-start justify-center px-4 pt-20 pb-8">
        <div className="w-full max-w-xl space-y-6 text-[var(--text-main)]">

          {/* Language Settings */}
          <section>
            <h2 className="mb-3 text-xs font-medium">{t('settings.language')}</h2>
            <LanguageSection />
          </section>

          {/* Avatar */}
          <section>
            <h2 className="mb-3 text-xs font-medium">{t('settings.avatar')}</h2>
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-[var(--panel-border)] bg-black/20">
                {avatarPreview ? (
                  <img alt={currentDisplayName} className="h-full w-full object-cover" src={avatarPreview} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-soft">--</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-soft">{user ? t('settings.cloudSync') : t('settings.loginRequired')}</p>
                <div className="mt-2 flex gap-2">
                  <button className={btnCls} disabled={avatarDisabled} onClick={() => avatarInputRef.current?.click()} type="button">{t('settings.upload')}</button>
                  <button className={`${btnCls} text-soft`} disabled={avatarDisabled || !displayAvatar} onClick={resetDisplayAvatar} type="button">{t('settings.reset')}</button>
                </div>
              </div>
              <input
                accept="image/*"
                aria-label={t('settings.uploadAvatar')}
                className="hidden"
                onChange={(event) => {
                  void handleAvatarFile(event.target.files?.[0]);
                  event.target.value = '';
                }}
                ref={avatarInputRef}
                type="file"
              />
            </div>
          </section>

          {/* Username */}
          <section>
            <h2 className="mb-3 text-xs font-medium">{t('settings.username')}</h2>
            <p className="mb-2 text-[10px] text-soft">{t('settings.cloudSync')}</p>
            <input
              className="w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2.5 text-sm text-[var(--text-main)] outline-none transition focus:border-[var(--text-accent)] disabled:opacity-40"
              disabled={nameDisabled}
              onChange={(event) => setNameInput(event.target.value)}
              placeholder={user ? user.login : t('settings.loginRequired')}
              type="text"
              value={nameInput}
            />
            <div className="mt-2 flex gap-2">
              <button className={btnCls} disabled={nameDisabled} onClick={() => void setDisplayName(nameInput)} type="button">{t('settings.save')}</button>
              <button className={`${btnCls} text-soft`} disabled={nameDisabled || !displayName} onClick={resetDisplayName} type="button">{t('settings.reset')}</button>
            </div>
          </section>

          {/* Background */}
          <section>
            <h2 className="mb-3 text-xs font-medium">{t('settings.background')}</h2>
            <div className="flex items-start gap-4">
              <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-[var(--panel-border)] bg-black/20">
                {bgPreview ? (
                  <img alt={t('settings.backgroundPreview')} className="h-full w-full object-cover" src={bgPreview} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-soft">{t('settings.default')}</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-soft">{t('settings.localOnly')}</p>
                <div className="mt-2 flex gap-2">
                  <button className={btnCls} onClick={() => bgInputRef.current?.click()} type="button">{t('settings.upload')}</button>
                  <button className={`${btnCls} text-soft`} disabled={!backgroundImage} onClick={resetBackgroundImage} type="button">{t('settings.reset')}</button>
                </div>
              </div>
            </div>
            {backgroundImage && (
              <div className="mt-3 flex items-center gap-3">
                <span className="shrink-0 text-[10px] text-soft">{t('settings.opacity')}</span>
                <input
                  aria-label={t('settings.backgroundOpacity')}
                  className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-[var(--text-accent)]"
                  max="100"
                  min="10"
                  onChange={(event) => setBackgroundOpacity(Number(event.target.value) / 100)}
                  type="range"
                  value={Math.round(backgroundOpacity * 100)}
                />
                <span className="w-8 text-right text-[10px] text-soft">{Math.round(backgroundOpacity * 100)}%</span>
              </div>
            )}
            <input
              accept="image/*"
              aria-label={t('settings.uploadBackground')}
              className="hidden"
              onChange={(event) => {
                void handleBackgroundFile(event.target.files?.[0]);
                event.target.value = '';
              }}
              ref={bgInputRef}
              type="file"
            />
          </section>

          {/* Account Binding */}
          {user && (
            <section>
              <h2 className="mb-3 text-xs font-medium">{t('settings.accountBinding')}</h2>
              <AccountBindingSection />
            </section>
          )}

          {/* Admin: Invite Code */}
          {auth.isAdmin && (
            <section>
              <h2 className="mb-3 text-xs font-medium">{t('settings.inviteCode')}</h2>
              <InviteCodeSection />
            </section>
          )}

          {/* Admin: Notification Email */}
          {auth.isAdmin && (
            <section>
              <h2 className="mb-3 text-xs font-medium">{t('settings.adminEmail')}</h2>
              <p className="mb-2 text-[10px] text-soft">{t('settings.adminEmailDesc')}</p>
              <AdminNotificationEmailSection />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
