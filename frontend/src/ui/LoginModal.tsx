import { Github, Mail } from 'lucide-react';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (provider: 'github' | 'google') => void;
  showGoogle?: boolean;
}

export function LoginModal({ open, onClose, onSelect, showGoogle = true }: LoginModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-xs rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-5 py-4 text-[var(--text-main)] shadow-xl backdrop-blur-xl">
        <p className="text-center text-sm font-medium">选择登录方式</p>
        <div className="mt-4 flex flex-col gap-3">
          <button
            className="flex items-center justify-center gap-2 rounded-full border border-[var(--panel-border)] px-4 py-2 text-sm transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)]"
            onClick={() => {
              onSelect('github');
              onClose();
            }}
            type="button"
          >
            <Github size={16} />
            GitHub 登录
          </button>
          {showGoogle ? (
            <button
              className="flex items-center justify-center gap-2 rounded-full border border-[var(--panel-border)] px-4 py-2 text-sm transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)]"
              onClick={() => {
                onSelect('google');
                onClose();
              }}
              type="button"
            >
              <Mail size={16} />
              Google 登录
            </button>
          ) : null}
        </div>
        <button
          className="mt-4 w-full text-center text-xs text-soft hover:text-[var(--text-main)] transition"
          onClick={onClose}
          type="button"
        >
          取消
        </button>
      </div>
    </div>
  );
}
