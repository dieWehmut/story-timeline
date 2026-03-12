import { LogOut, UserRound } from 'lucide-react';
import type { AuthUser } from '../types/image';

interface AuthButtonProps {
  authenticated: boolean;
  loading: boolean;
  user: AuthUser | null;
  onLogin: () => void;
  onLogout: () => Promise<void>;
}

const iconBtnCls =
  'inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95';

export function AuthButton({ authenticated, loading, onLogin, onLogout, user }: AuthButtonProps) {
  if (!user && !authenticated) {
    return (
      <button
        aria-busy={loading}
        aria-label="GitHub login"
        className={`${iconBtnCls} ${loading ? 'opacity-70' : ''}`}
        onClick={onLogin}
        type="button"
      >
        <UserRound size={24} />
      </button>
    );
  }

  return (
    <button
      aria-label={`Log out ${user?.login ?? 'current account'}`}
      className={iconBtnCls}
      onClick={() => void onLogout()}
      type="button"
    >
      <LogOut size={24} />
    </button>
  );
}
