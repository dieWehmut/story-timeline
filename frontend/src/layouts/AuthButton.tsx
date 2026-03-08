import { Github, LogOut } from 'lucide-react';
import { Button } from '../ui/Button';
import type { AuthUser } from '../types/image';

interface AuthButtonProps {
  loading: boolean;
  user: AuthUser | null;
  onLogin: () => void;
  onLogout: () => Promise<void>;
}

export function AuthButton({ loading, onLogin, onLogout, user }: AuthButtonProps) {
  if (loading) {
    return (
      <Button
        aria-label="载入中"
        className="h-14 w-14 rounded-[1.35rem] border border-white/12 bg-[var(--button-bg)] p-0 shadow-[0_14px_30px_rgba(15,23,42,0.3)] transition-all duration-300"
        disabled
        variant="secondary"
      >
        <Github size={20} />
      </Button>
    );
  }

  if (!user) {
    return (
      <Button
        aria-label="GitHub 登录"
        className="h-14 w-14 rounded-[1.35rem] border border-white/12 bg-[var(--button-bg)] p-0 shadow-[0_14px_30px_rgba(15,23,42,0.3)] transition-all duration-300 hover:-translate-y-1 hover:scale-105 hover:bg-[var(--button-hover)] hover:shadow-[0_18px_38px_rgba(34,211,238,0.22)] active:scale-95"
        onClick={onLogin}
        variant="secondary"
      >
        <Github className="transition-transform duration-300 hover:rotate-6" size={20} />
      </Button>
    );
  }

  return (
    <Button
      aria-label={`退出 ${user.login}`}
      className="h-14 w-14 rounded-[1.35rem] border border-white/12 bg-[var(--button-bg)] p-0 shadow-[0_14px_30px_rgba(15,23,42,0.3)] transition-all duration-300 hover:-translate-y-1 hover:scale-105 hover:bg-[var(--button-hover)] hover:shadow-[0_18px_38px_rgba(34,211,238,0.22)] active:scale-95"
      onClick={() => void onLogout()}
      variant="secondary"
    >
      <LogOut className="transition-transform duration-300 hover:-rotate-6" size={20} />
    </Button>
  );
}