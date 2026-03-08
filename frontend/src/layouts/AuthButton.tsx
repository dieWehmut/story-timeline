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
      <Button block className="rounded-2xl bg-[var(--button-bg)] px-4 py-3" disabled variant="secondary">
        载入中
      </Button>
    );
  }

  if (!user) {
    return (
      <Button block className="rounded-2xl bg-[var(--button-bg)] px-4 py-3" onClick={onLogin} variant="secondary">
        <Github size={16} />
        GitHub 登录
      </Button>
    );
  }

  return (
    <div className="glass-panel flex w-full items-center gap-3 rounded-3xl px-3 py-3">
      <img alt={user.login} className="h-10 w-10 rounded-2xl object-cover" src={user.avatarUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--text-main)]">{user.login}</p>
        <p className="text-xs text-soft">已连接 GitHub</p>
      </div>
      <Button aria-label="退出登录" className="h-10 w-10 rounded-2xl p-0" onClick={() => void onLogout()} variant="ghost">
        <LogOut size={16} />
      </Button>
    </div>
  );
}