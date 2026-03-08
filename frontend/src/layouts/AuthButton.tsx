import { LogOut, UserRound } from 'lucide-react';
import { Button } from '../ui/Button';
import type { AuthUser } from '../types/image';

interface AuthButtonProps {
  loading: boolean;
  user: AuthUser | null;
  onLogin: () => void;
  onLogout: () => Promise<void>;
}

const btnCls =
  'floating-btn h-12 w-12 rounded-xl p-0 transition-all duration-300 hover:-translate-y-0.5 hover:scale-105 active:scale-95';

export function AuthButton({ loading, onLogin, onLogout, user }: AuthButtonProps) {
  if (loading) {
    return (
      <Button
        aria-label="载入中"
        className={btnCls}
        disabled
        variant="secondary"
      >
        <UserRound size={34} />
      </Button>
    );
  }

  if (!user) {
    return (
      <Button
        aria-label="GitHub 登录"
        className={btnCls}
        onClick={onLogin}
        variant="secondary"
      >
        <UserRound size={34} />
      </Button>
    );
  }

  return (
    <Button
      aria-label={`退出 ${user.login}`}
      className={btnCls}
      onClick={() => void onLogout()}
      variant="secondary"
    >
      <LogOut size={34} />
    </Button>
  );
}