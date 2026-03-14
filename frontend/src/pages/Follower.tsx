import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { HomeButton } from '../layouts/HomeButton';
import { ThemeButton } from '../layouts/ThemeButton';
import { SettingsButton } from '../layouts/SettingsButton';
import { FollowButton } from '../ui/FollowButton';
import { LoginModal } from '../ui/LoginModal';
import { useAuth } from '../hooks/useAuth';
import { useFollows } from '../hooks/useFollows';
import { useProfile } from '../context/ProfileContext';

interface FollowerProps {
  auth: ReturnType<typeof useAuth>;
  follows: ReturnType<typeof useFollows>;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
}

export default function Follower({ auth, follows, theme, onThemeToggle }: FollowerProps) {
  const profile = useProfile();
  const navigate = useNavigate();
  const [loginOpen, setLoginOpen] = useState(false);
  const list = follows.followers;
  const count = list.length;

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen pb-28">
      <header className="fixed left-0 right-0 top-0 z-40 px-3 pt-3">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between">
          <button
            aria-label="返回"
            className="inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition hover:text-[var(--text-accent)] active:scale-95"
            onClick={handleBack}
            type="button"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="flex flex-col items-center">
            <span className="text-sm font-medium text-[var(--text-main)]">粉丝</span>
            <span className="text-xs text-soft">{count}</span>
          </div>
          <div className="flex items-center -space-x-1">
            <HomeButton />
            <SettingsButton />
            <ThemeButton onToggle={onThemeToggle} theme={theme} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pt-20">
        {follows.error ? (
          <div className="mb-4 rounded border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {follows.error}
          </div>
        ) : null}
        {!auth.authenticated ? (
          <div className="mt-10 flex flex-col items-center gap-4 text-sm text-soft">
            <p>请先登录查看粉丝列表</p>
            <button
              className="rounded-full border border-[var(--panel-border)] px-4 py-2 text-sm text-[var(--text-main)] transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)]"
              onClick={() => setLoginOpen(true)}
              type="button"
            >
              登录
            </button>
          </div>
        ) : list.length === 0 ? (
          <p className="mt-10 text-center text-sm text-soft">暂无粉丝</p>
        ) : (
          <div className="divide-y divide-[var(--panel-border)]">
            {list.map((user) => {
              const followed = follows.isFollowing(user.login);
              const displayName = profile.resolveName(user.login);
              const displayAvatar = profile.resolveAvatar(user.login, user.avatarUrl);
              return (
                <div className="flex items-center justify-between py-3" key={user.login}>
                  <button
                    className="flex items-center gap-3"
                    onClick={() => navigate(`/story?user=${encodeURIComponent(user.login)}`)}
                    type="button"
                  >
                    <img
                      alt={displayName || user.login}
                      className="h-9 w-9 rounded-full object-cover ring-1 ring-white/10"
                      src={displayAvatar}
                    />
                    <span className="text-sm text-[var(--text-main)]">{displayName || user.login}</span>
                  </button>
                  {auth.user?.login.toLowerCase() !== user.login.toLowerCase() ? (
                    <FollowButton
                      following={followed}
                      disabled={follows.loading}
                      onClick={() =>
                        void (followed
                          ? follows.unfollow(user.login)
                          : follows.follow(user.login, user.avatarUrl))
                      }
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSelect={auth.loginWith}
        onEmailLogin={auth.requestEmailLogin}
        emailPolling={auth.emailPolling}
        showGoogle={!!auth.googleLoginUrl}
        showEmail={!!auth.requestEmailLogin}
      />
    </div>
  );
}
