import { useState, type MouseEvent } from 'react';
import { LogOut, UserRound } from 'lucide-react';
import type { AuthUser } from '../types/image';
import { LoginModal } from '../ui/LoginModal';

interface AuthButtonProps {
  authenticated: boolean;
  loading: boolean;
  loginUrl?: string;
  googleLoginUrl?: string;
  emailLoginUrl?: string;
  user: AuthUser | null;
  onLogin: (provider: 'github' | 'google') => void;
  onEmailLogin?: (email: string) => Promise<void> | void;
  onLogout: () => Promise<void>;
  emailPolling?: boolean;
}

const iconBtnCls =
  'inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95';

export function AuthButton({
  authenticated,
  loading,
  loginUrl,
  googleLoginUrl,
  emailLoginUrl,
  onLogin,
  onEmailLogin,
  onLogout,
  user,
  emailPolling,
}: AuthButtonProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!authenticated || !user) {
      if (loginUrl || googleLoginUrl || emailLoginUrl) {
        setShowPicker(true);
      } else {
        onLogin('github');
      }
      return;
    }
    void onLogout();
  };

  return (
    <>
      <button
        aria-busy={loading}
        aria-label={authenticated ? `Log out ${user?.login ?? 'current account'}` : '登录'}
        className={`${iconBtnCls} ${loading ? 'opacity-70' : ''}`}
        onClick={handleClick}
        type="button"
      >
        {authenticated && user ? <LogOut size={24} /> : <UserRound size={24} />}
      </button>
      {!authenticated || !user ? (
        <LoginModal
          open={showPicker}
          onClose={() => setShowPicker(false)}
          onSelect={onLogin}
          onEmailLogin={onEmailLogin}
          showGoogle={!!googleLoginUrl}
          showEmail={!!onEmailLogin}
          emailPolling={emailPolling}
        />
      ) : null}
    </>
  );
}
