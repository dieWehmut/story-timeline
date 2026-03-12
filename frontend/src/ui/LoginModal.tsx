import { Github } from 'lucide-react';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (provider: 'github' | 'google') => void;
  showGoogle?: boolean;
}

function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="shrink-0"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <path
        d="M21.35 11.1h-9.17v2.98h5.33c-.23 1.48-1.73 4.33-5.33 4.33-3.2 0-5.82-2.65-5.82-5.9s2.62-5.9 5.82-5.9c1.82 0 3.05.78 3.75 1.46l2.56-2.46C16.88 4.1 14.76 3 12.18 3 7.91 3 4.5 6.45 4.5 10.51s3.41 7.51 7.68 7.51c4.44 0 7.38-3.12 7.38-7.51 0-.5-.06-.88-.13-1.26z"
        fill="currentColor"
      />
    </svg>
  );
}

export function LoginModal({ open, onClose, onSelect, showGoogle = true }: LoginModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-5 py-4 text-[var(--text-main)] shadow-xl backdrop-blur-xl"
        onClick={(event) => event.stopPropagation()}
      >
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
              <GoogleIcon size={16} />
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
