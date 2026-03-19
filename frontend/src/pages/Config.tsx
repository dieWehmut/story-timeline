import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Copy, Link, RefreshCw, Trash2 } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { api } from '../lib/api';
import { useToast } from '../utils/useToast';
import { useAuth } from '../hooks/useAuth';
import type { Identity } from '../types/image';

interface ConfigProps {
  auth: ReturnType<typeof useAuth>;
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
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loading, setLoading] = useState(true);
  const [bindingInProgress, setBingingInProgress] = useState<string | null>(null);
  const [emailBindInput, setEmailBindInput] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);

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
    } catch (err) {
      toast('绑定失败', 'error');
      setBingingInProgress(null);
    }
  };

  const handleEmailBind = async () => {
    const email = emailBindInput.trim();
    if (!email) {
      toast('请输入邮箱地址', 'error');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      toast('邮箱格式不正确', 'error');
      return;
    }

    try {
      setBingingInProgress('email');
      await api.bindEmail(email);
      toast('验证邮件已发送，请查收邮箱', 'success');
      setShowEmailInput(false);
      setEmailBindInput('');
    } catch (err) {
      const message = err instanceof Error ? err.message : '绑定失败';
      if (message.includes('email_already_bound')) {
        toast('该邮箱已被其他账户绑定', 'error');
      } else {
        toast(message, 'error');
      }
    } finally {
      setBingingInProgress(null);
    }
  };

  const handleUnbind = async (targetProvider: string) => {
    if (identities.length <= 1) {
      toast('不能解绑唯一的登录方式', 'error');
      return;
    }

    if (!confirm(`确定要解绑 ${getProviderName(targetProvider)} 吗？`)) {
      return;
    }

    try {
      await api.unbindProvider(targetProvider);
      setIdentities(identities.filter(id => id.provider !== targetProvider));
      toast('解绑成功', 'success');
    } catch (err) {
      toast('解绑失败', 'error');
    }
  };

  const getProviderName = (prov: string) => {
    switch (prov) {
      case 'github': return 'GitHub';
      case 'google': return 'Google';
      case 'email': return '邮箱';
      default: return prov;
    }
  };

  const getProviderIcon = (prov: string) => {
    switch (prov) {
      case 'github': return <GitHubIcon size={14} />;
      case 'google': return <GoogleIcon size={14} />;
      case 'email': return <EmailIcon size={14} />;
      default: return null;
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

  const allProviders = ['github', 'google', 'email'];

  return (
    <div className="space-y-3">
      {allProviders.map(targetProvider => {
        const bound = isBound(targetProvider);
        const identity = identities.find(id => id.provider === targetProvider);

        return (
          <div key={targetProvider} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getProviderIcon(targetProvider)}
              <span className="text-xs">{getProviderName(targetProvider)}</span>
              {bound && identity && (
                <span className="text-[10px] text-soft">
                  {identity.email || identity.providerId}
                </span>
              )}
            </div>
            {bound ? (
              <button
                className={`${btnCls} text-soft`}
                disabled={identities.length <= 1}
                onClick={() => void handleUnbind(targetProvider)}
                title={identities.length <= 1 ? '不能解绑唯一的登录方式' : ''}
                type="button"
              >
                解绑
              </button>
            ) : (
              <button
                className={btnCls}
                disabled={bindingInProgress === targetProvider}
                onClick={() => void handleBind(targetProvider)}
                type="button"
              >
                {bindingInProgress === targetProvider ? '绑定中..' : '绑定'}
              </button>
            )}
          </div>
        );
      })}

      {/* Email binding input */}
      {showEmailInput && (
        <div className="mt-2 space-y-2 rounded-lg border border-[var(--panel-border)] bg-black/10 p-2.5">
          <input
            className="w-full rounded-lg border border-[var(--panel-border)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none transition focus:border-[var(--text-accent)]"
            onChange={(e) => setEmailBindInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleEmailBind(); }}
            placeholder="输入要绑定的邮箱地址"
            type="email"
            value={emailBindInput}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              className={btnCls}
              disabled={bindingInProgress === 'email'}
              onClick={() => void handleEmailBind()}
              type="button"
            >
              {bindingInProgress === 'email' ? '发送中..' : '发送验证邮件'}
            </button>
            <button
              className={`${btnCls} text-soft`}
              onClick={() => { setShowEmailInput(false); setEmailBindInput(''); }}
              type="button"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {identities.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--panel-border)]">
          <p className="text-[10px] text-soft">
            已绑定 {identities.length} 种登录方式
          </p>
        </div>
      )}
    </div>
  );
}

export default function Config({ auth }: ConfigProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
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
      toast('绑定成功', 'success');
    } else if (bind === 'already') {
      toast('该账号已绑定', 'info');
    } else if (error) {
      switch (error) {
        case 'invalid_state':
          toast('绑定失败：无效的状态', 'error');
          break;
        case 'oauth_failed':
          toast('绑定失败：OAuth 认证失败', 'error');
          break;
        case 'already_bound':
          toast('该账号已被其他用户绑定', 'error');
          break;
        case 'bind_failed':
          toast('绑定失败', 'error');
          break;
        default:
          toast(`绑定失败：${error}`, 'error');
      }
    }

    // Clear query params
    if (bind || error) {
      searchParams.delete('bind');
      searchParams.delete('error');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, toast]);

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
      <div className="flex flex-1 items-start justify-center px-4 py-8">
        <div className="w-full max-w-xl text-[var(--text-main)]">
          {/* Header with back button */}
          <div className="mb-4 flex items-center gap-3">
            <button
              aria-label="返回"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--panel-border)] text-soft transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)]"
              onClick={() => navigate(-1)}
              type="button"
            >
              <ArrowLeft size={16} />
            </button>
            <h1 className="text-lg font-semibold">设置</h1>
          </div>

          <div className="space-y-3">
            {/* Avatar + Username + Background */}
            <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[var(--panel-border)] bg-black/20">
                  {avatarPreview ? (
                    <img alt={currentDisplayName} className="h-full w-full object-cover" src={avatarPreview} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-soft">--</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">头像</p>
                  <p className="text-[10px] text-soft">{user ? '云端同步' : '登录后可设置'}</p>
                  <div className="mt-1.5 flex gap-1.5">
                    <button className={btnCls} disabled={avatarDisabled} onClick={() => avatarInputRef.current?.click()} type="button">上传</button>
                    <button className={`${btnCls} text-soft`} disabled={avatarDisabled || !displayAvatar} onClick={resetDisplayAvatar} type="button">恢复</button>
                  </div>
                </div>
                <input
                  accept="image/*"
                  aria-label="上传头像"
                  className="hidden"
                  onChange={(event) => {
                    void handleAvatarFile(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                  ref={avatarInputRef}
                  type="file"
                />
              </div>

              <div className="my-2.5 h-px bg-[var(--panel-border)]" />

              <div>
                <p className="text-xs font-medium">用户名</p>
                <p className="text-[10px] text-soft">云端同步</p>
                <input
                  className="mt-1.5 w-full rounded-lg border border-[var(--panel-border)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none transition focus:border-[var(--text-accent)] disabled:opacity-40"
                  disabled={nameDisabled}
                  onChange={(event) => setNameInput(event.target.value)}
                  placeholder={user ? user.login : '请先登录'}
                  type="text"
                  value={nameInput}
                />
                <div className="mt-1.5 flex gap-1.5">
                  <button className={btnCls} disabled={nameDisabled} onClick={() => void setDisplayName(nameInput)} type="button">保存</button>
                  <button className={`${btnCls} text-soft`} disabled={nameDisabled || !displayName} onClick={resetDisplayName} type="button">恢复</button>
                </div>
              </div>

              <div className="my-2.5 h-px bg-[var(--panel-border)]" />

              <div className="flex items-start gap-3">
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-[var(--panel-border)] bg-black/20">
                  {bgPreview ? (
                    <img alt="背景预览" className="h-full w-full object-cover" src={bgPreview} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-soft">默认</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">背景</p>
                  <p className="text-[10px] text-soft">仅本地存储，不会上传</p>
                  <div className="mt-1.5 flex gap-1.5">
                    <button className={btnCls} onClick={() => bgInputRef.current?.click()} type="button">上传</button>
                    <button className={`${btnCls} text-soft`} disabled={!backgroundImage} onClick={resetBackgroundImage} type="button">恢复</button>
                  </div>
                </div>
              </div>
              {backgroundImage ? (
                <div className="mt-2.5 flex items-center gap-2.5">
                  <span className="shrink-0 text-[10px] text-soft">透明度</span>
                  <input
                    aria-label="背景透明度"
                    className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-[var(--text-accent)]"
                    max="100"
                    min="10"
                    onChange={(event) => setBackgroundOpacity(Number(event.target.value) / 100)}
                    type="range"
                    value={Math.round(backgroundOpacity * 100)}
                  />
                  <span className="w-7 text-right text-[10px] text-soft">{Math.round(backgroundOpacity * 100)}%</span>
                </div>
              ) : null}
              <input
                accept="image/*"
                aria-label="上传背景"
                className="hidden"
                onChange={(event) => {
                  void handleBackgroundFile(event.target.files?.[0]);
                  event.target.value = '';
                }}
                ref={bgInputRef}
                type="file"
              />
            </div>

            {auth.isAdmin && (
              <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3 backdrop-blur-xl">
                <p className="mb-2 text-xs font-medium">邀请码管理</p>
                <InviteCodeSection />
              </div>
            )}

            {auth.isAdmin && (
              <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3 backdrop-blur-xl">
                <p className="mb-2 text-xs font-medium">管理员邮箱</p>
                <p className="mb-2 text-[10px] text-soft">用于接收新用户注册通知</p>
                <AdminNotificationEmailSection />
              </div>
            )}

            {user && (
              <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3 backdrop-blur-xl">
                <p className="mb-2 text-xs font-medium">账号绑定</p>
                <AccountBindingSection />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
