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

export function ConfigModal({ open, onClose }: ConfigModalProps) {
  const {
    user,
    displayName,
    displayAvatar,
    backgroundImage,
    currentDisplayName,
    currentAvatar,
    setDisplayName,
    setDisplayAvatar,
    resetDisplayName,
    resetDisplayAvatar,
    setBackgroundImage,
    resetBackgroundImage,
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
      const dataUrl = await readAsDataUrl(file);
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
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-6 py-5 text-[var(--text-main)] shadow-xl backdrop-blur-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold">设置</p>
          <button
            aria-label="关闭"
            className="inline-flex h-8 w-8 items-center justify-center text-soft transition hover:text-[var(--text-main)]"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <section className="flex h-full flex-col gap-3 rounded-2xl border border-[var(--panel-border)] bg-white/5 p-4">
            <div>
              <p className="text-sm font-semibold">头像设置</p>
              <p className="text-xs text-soft">云端同步，修改后所有设备可见</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 overflow-hidden rounded-full border border-[var(--panel-border)] bg-black/20">
                {avatarPreview ? (
                  <img alt={currentDisplayName} className="h-full w-full object-cover" src={avatarPreview} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-soft">
                    --
                  </div>
                )}
              </div>
              <div className="text-xs text-soft">
                {user ? `当前：${currentDisplayName}` : '登录后可设置'}
              </div>
            </div>
            <div className="mt-auto flex flex-wrap gap-2">
              <button
                className="rounded-full border border-[var(--panel-border)] px-3 py-1.5 text-xs transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)] disabled:opacity-40"
                disabled={avatarDisabled}
                onClick={() => avatarInputRef.current?.click()}
                type="button"
              >
                上传头像
              </button>
              <button
                className="rounded-full border border-[var(--panel-border)] px-3 py-1.5 text-xs text-soft transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)] disabled:opacity-40"
                disabled={avatarDisabled || !displayAvatar}
                onClick={resetDisplayAvatar}
                type="button"
              >
                恢复默认
              </button>
              <input
                accept="image/*"
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

          <section className="flex h-full flex-col gap-3 rounded-2xl border border-[var(--panel-border)] bg-white/5 p-4">
            <div>
              <p className="text-sm font-semibold">用户名设置</p>
              <p className="text-xs text-soft">
                {user?.provider === 'github'
                  ? 'GitHub 登录仍保留 GitHub 名用于同步关注者，这里仅设置显示名'
                  : '显示名会同步到云端，所有设备可见'}
              </p>
            </div>
            <input
              className="w-full rounded-xl border border-[var(--panel-border)] bg-transparent px-3 py-2 text-sm text-[var(--text-main)] outline-none transition focus:border-[var(--text-accent)] disabled:opacity-40"
              disabled={nameDisabled}
              onChange={(event) => setNameInput(event.target.value)}
              placeholder={user ? user.login : '请先登录'}
              type="text"
              value={nameInput}
            />
            <div className="mt-auto flex flex-wrap gap-2">
              <button
                className="rounded-full border border-[var(--panel-border)] px-3 py-1.5 text-xs transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)] disabled:opacity-40"
                disabled={nameDisabled}
                onClick={() => void setDisplayName(nameInput)}
                type="button"
              >
                保存显示名
              </button>
              <button
                className="rounded-full border border-[var(--panel-border)] px-3 py-1.5 text-xs text-soft transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)] disabled:opacity-40"
                disabled={nameDisabled || !displayName}
                onClick={resetDisplayName}
                type="button"
              >
                恢复默认
              </button>
            </div>
          </section>

          <section className="flex h-full flex-col gap-3 rounded-2xl border border-[var(--panel-border)] bg-white/5 p-4">
            <div>
              <p className="text-sm font-semibold">背景设置</p>
              <p className="text-xs text-soft">背景图仅本地存储，不会上传</p>
            </div>
            <div className="h-20 overflow-hidden rounded-xl border border-[var(--panel-border)] bg-black/20">
              {bgPreview ? (
                <img alt="背景预览" className="h-full w-full object-cover" src={bgPreview} />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-soft">
                  默认背景
                </div>
              )}
            </div>
            <div className="mt-auto flex flex-wrap gap-2">
              <button
                className="rounded-full border border-[var(--panel-border)] px-3 py-1.5 text-xs transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)]"
                onClick={() => bgInputRef.current?.click()}
                type="button"
              >
                上传背景
              </button>
              <button
                className="rounded-full border border-[var(--panel-border)] px-3 py-1.5 text-xs text-soft transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)] disabled:opacity-40"
                disabled={!backgroundImage}
                onClick={resetBackgroundImage}
                type="button"
              >
                恢复默认
              </button>
              <input
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  void handleBackgroundFile(event.target.files?.[0]);
                  event.target.value = '';
                }}
                ref={bgInputRef}
                type="file"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
