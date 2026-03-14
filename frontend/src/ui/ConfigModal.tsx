import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';

interface ConfigModalProps {
  open: boolean;
  onClose: () => void;
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

export function ConfigModal({ open, onClose }: ConfigModalProps) {
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
          {/* Avatar + Username */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl border border-[var(--panel-border)] bg-white/5 p-3">
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

            <div className="rounded-xl border border-[var(--panel-border)] bg-white/5 p-3">
              <p className="text-xs font-medium">用户名</p>
              <p className="text-[10px] text-soft">
                云端同步
              </p>
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
          </div>

          {/* Background */}
          <div className="rounded-xl border border-[var(--panel-border)] bg-white/5 p-3">
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
        </div>
      </div>
    </div>
  );
}
