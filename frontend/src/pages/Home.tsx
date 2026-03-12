import { useState } from 'react';
import { BookOpen, Download, Github, Image as ImageIcon, LogIn, LogOut, UserCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ThemeButton } from '../layouts/ThemeButton';
import { useAuth } from '../hooks/useAuth';
import { useImages } from '../hooks/useImages';
import { useFollows } from '../hooks/useFollows';
import { LoginModal } from '../ui/LoginModal';

interface HomeProps {
  auth: ReturnType<typeof useAuth>;
  images: ReturnType<typeof useImages>;
  follows: ReturnType<typeof useFollows>;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
}

interface NavCardProps {
  icon: typeof BookOpen;
  label: string;
  subLabel?: string;
  to?: string;
  href?: string;
  external?: boolean;
  disabled?: boolean;
}

function NavCard({ icon: Icon, label, subLabel, to, href, external, disabled }: NavCardProps) {
  const baseClass =
    'group flex h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] text-[var(--text-main)] shadow-[var(--panel-shadow)] transition hover:-translate-y-0.5 hover:border-[var(--text-accent)]';

  if (disabled) {
    return (
      <div
        aria-disabled="true"
        className={`${baseClass} cursor-not-allowed opacity-40`}
        title="请先登录"
      >
        <Icon className="home-nav-icon text-cyan-300" size={26} />
        <span className="text-sm">{label}</span>
        {subLabel ? <span className="text-xs text-soft">{subLabel}</span> : null}
      </div>
    );
  }

  if (to) {
    return (
      <Link className={baseClass} to={to}>
        <Icon className="home-nav-icon text-cyan-300 transition group-hover:text-[var(--text-accent)]" size={26} />
        <span className="text-sm">{label}</span>
        {subLabel ? <span className="text-xs text-soft">{subLabel}</span> : null}
      </Link>
    );
  }

  return (
    <a
      className={baseClass}
      href={href}
      rel={external ? 'noopener noreferrer' : undefined}
      target={external ? '_blank' : undefined}
    >
      <Icon className="home-nav-icon text-cyan-300 transition group-hover:text-[var(--text-accent)]" size={26} />
      <span className="text-sm">{label}</span>
      {subLabel ? <span className="text-xs text-soft">{subLabel}</span> : null}
    </a>
  );
}

export default function Home({ auth, images, follows, theme, onThemeToggle }: HomeProps) {
  const [loginOpen, setLoginOpen] = useState(false);
  const githubOwner = images.stats.githubOwner || auth.user?.login || 'GitHub';
  const repoUrl = `https://github.com/${githubOwner}/story-timeline`;
  const androidUrl = `${repoUrl}/releases/latest`;
  const albumUser = auth.user?.login || githubOwner;
  const albumUrl = `/album?user=${encodeURIComponent(albumUser)}`;
  const albumDisabled = !auth.authenticated;
  const followsDisabled = !auth.authenticated;
  const followingCount = follows.following.length;
  const followerCount = follows.followers.length;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="px-4 pt-3">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            {auth.user ? (
              <>
                <span className="text-sm font-medium text-[var(--text-main)]">{auth.user.login}</span>
                <button
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--panel-border)] px-3 py-1.5 text-sm text-[var(--text-main)] transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)]"
                  onClick={() => void auth.logout()}
                  type="button"
                >
                  <LogOut size={16} />
                  登出
                </button>
              </>
            ) : (
              <button
                className="inline-flex items-center gap-2 rounded-full border border-[var(--panel-border)] px-3 py-1.5 text-sm text-[var(--text-main)] transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)]"
                onClick={() => setLoginOpen(true)}
                type="button"
              >
                <LogIn size={16} />
                登录
              </button>
            )}
          </div>
          <ThemeButton onToggle={onThemeToggle} theme={theme} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 pb-14 pt-2 text-center">
        <h1 className="font-serif text-4xl font-semibold tracking-wide text-[var(--text-main)] md:text-5xl">物语集</h1>
        <p className="mt-2 text-sm text-soft">
          用户数：{images.stats.userCount}
        </p>

        <div className="mt-6 grid w-full max-w-xl grid-cols-2 gap-4">
          <NavCard icon={BookOpen} label="物语" to="/story" />
          <NavCard icon={ImageIcon} label="相册" to={albumUrl} disabled={albumDisabled} />
          <NavCard icon={UserCheck} label="关注" to="/following" disabled={followsDisabled} subLabel={auth.authenticated ? `${followingCount} 人` : undefined} />
          <NavCard icon={Users} label="粉丝" to="/follower" disabled={followsDisabled} subLabel={auth.authenticated ? `${followerCount} 人` : undefined} />
          
          
          <NavCard icon={Github} label="代码仓库" href={repoUrl} external />
          <NavCard icon={Download} label="Android" href={androidUrl} external />
        </div>
      </main>

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSelect={auth.loginWith}
        showGoogle={!!auth.googleLoginUrl}
      />
    </div>
  );
}


