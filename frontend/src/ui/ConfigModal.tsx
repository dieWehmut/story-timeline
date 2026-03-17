import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, RefreshCw, Trash2, X } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { api } from '../lib/api';

interface ConfigModalProps {
  open: boolean;
  onClose: () => void;
  isAdmin?: boolean;
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
  const [copied, setCopied] = useState(false);

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
      setCopied(true);
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
          <button aria-label="复制" className={iconBtnCls} onClick={() => void handleCopy()} title="复制" type="button">
            <Copy size={12} />
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
          {copied ? '已复制!' : `有效期: ${formatExpiry(expiresAt)}`}
        </p>
      )}

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-soft">有效期</span>
        <select
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

export function ConfigModal({ open, onClose, isAdmin }: ConfigModalProps) {
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
    if (!open) return;
    setNameInput(displayName || user?.login || '');
  }, [displayName, open, user?.login]);

  if (!open) return null;

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
    <div
      className="modal-backdrop-enter fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="modal-panel-enter w-full max-w-xl rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-5 py-4 text-[var(--text-main)] shadow-xl backdrop-blur-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">设置</p>
          <button
            aria-label="关闭"
            className="inline-flex h-7 w-7 items-center justify-center text-soft transition hover:text-[var(--text-main)]"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {/* Avatar + Username + Background */}
          <div className="rounded-xl border border-[var(--panel-border)] bg-white/5 p-3">
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

          {isAdmin && (
            <div className="rounded-xl border border-[var(--panel-border)] bg-white/5 p-3">
              <p className="mb-2 text-xs font-medium">邀请码管理</p>
              <InviteCodeSection />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
