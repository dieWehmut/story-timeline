import { useState } from 'react';
import { LogOut, UserRound } from 'lucide-react';
import type { AuthUser } from '../types/image';
import { LoginModal } from '../ui/LoginModal';

interface AuthButtonProps {
  authenticated: boolean;
  loading: boolean;
  loginUrl?: string;
  googleLoginUrl?: string;
  user: AuthUser | null;
  onLogin: (provider: 'github' | 'google') => void;
  onLogout: () => Promise<void>;
}

const iconBtnCls =
  'inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95';

export function AuthButton({ authenticated, loading, loginUrl, googleLoginUrl, onLogin, onLogout, user }: AuthButtonProps) {
  const [showPicker, setShowPicker] = useState(false);
  if (!user && !authenticated) {
    return (
      <>
        <button
          aria-busy={loading}
          aria-label="登录"
          className={`${iconBtnCls} ${loading ? 'opacity-70' : ''}`}
          onClick={(event) => {
            event.preventDefault();
            if (loginUrl || googleLoginUrl) {
              setShowPicker(true);
            } else {
              onLogin('github');
            }
          }}
          type="button"
        >
          <UserRound size={24} />
        </button>
        <LoginModal
          open={showPicker}
          onClose={() => setShowPicker(false)}
          onSelect={onLogin}
          showGoogle={!!googleLoginUrl}
        />
      </>
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
