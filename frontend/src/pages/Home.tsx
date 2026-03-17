import { BookOpen, Download, Github, Image as ImageIcon, UserCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthButton } from '../layouts/AuthButton';
import { ThemeButton } from '../layouts/ThemeButton';
import { SettingsButton } from '../layouts/SettingsButton';
import { NotificationButton } from '../layouts/NotificationButton';
import { useAuth } from '../hooks/useAuth';
import { useImages } from '../hooks/useImages';
import { useFollows } from '../hooks/useFollows';
import { useProfile } from '../context/ProfileContext';

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
    'group flex h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] text-[var(--text-main)] shadow-[var(--panel-shadow)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--text-accent)] hover:shadow-[0_8px_30px_rgba(125,211,252,0.12)]';

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
        <Icon className="home-nav-icon text-cyan-300 transition-transform duration-300 group-hover:scale-110 group-hover:text-[var(--text-accent)]" size={26} />
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
      <Icon className="home-nav-icon text-cyan-300 transition-transform duration-300 group-hover:scale-110 group-hover:text-[var(--text-accent)]" size={26} />
      <span className="text-sm">{label}</span>
      {subLabel ? <span className="text-xs text-soft">{subLabel}</span> : null}
    </a>
  );
}

export default function Home({ auth, images, follows, theme, onThemeToggle }: HomeProps) {
  const profile = useProfile();
  const githubOwner = images.stats.githubOwner || auth.user?.login || 'GitHub';
  const repoUrl = `https://github.com/${githubOwner}/story-timeline`;
  const androidUrl = `${repoUrl}/releases/latest`;
  const albumUser = auth.user?.login || githubOwner;
  const albumUrl = `/album?user=${encodeURIComponent(albumUser)}`;
  const albumDisabled = !auth.authenticated;
  const followsDisabled = !auth.authenticated;
  const followingCount = follows.following.length;
  const followerCount = follows.followers.length;
  const authAuthenticated = auth.authenticated;
  const authLoading = auth.loading;
  const authUser = auth.user;
  const displayName = authUser ? profile.resolveName(authUser.login) : '';
  const displayAvatar = authUser ? profile.resolveAvatar(authUser.login, authUser.avatarUrl) : '';
  const onLogout = auth.logout;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="px-4 pt-3">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            {authAuthenticated && authUser ? (
              <>
                <img
                  alt={displayName || authUser.login}
                  className="h-9 w-9 rounded-full border border-[var(--panel-border)] object-cover"
                  src={displayAvatar}
                />
                <span className="text-sm font-medium text-[var(--text-main)]">{displayName || authUser.login}</span>
              </>
            ) : (
              <AuthButton
                authenticated={authAuthenticated}
                loading={authLoading}
                onLogout={onLogout}
                user={authUser}
              />
            )}
          </div>
          <div className="flex items-center -space-x-1">
            {authAuthenticated && authUser ? (
              <AuthButton
                authenticated={authAuthenticated}
                loading={authLoading}
                onLogout={onLogout}
                user={authUser}
              />
            ) : null}
            <NotificationButton isAdmin={auth.isAdmin} />
            <SettingsButton />
            <ThemeButton onToggle={onThemeToggle} theme={theme} />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 pb-14 pt-0 text-center">
        <h1 className="font-serif text-4xl font-semibold tracking-wide text-[var(--text-main)] md:text-5xl">物语集</h1>
        <p className="mt-1 text-sm text-soft">  記錄一下  </p>

        <div className="mt-6 grid w-full max-w-xl grid-cols-2 gap-4">
          <div className="nav-card-enter"><NavCard icon={BookOpen} label="物语" to="/story" /></div>
          <div className="nav-card-enter"><NavCard icon={ImageIcon} label="相册" to={albumUrl} disabled={albumDisabled} /></div>
          <div className="nav-card-enter"><NavCard icon={UserCheck} label="关注" to="/following" disabled={followsDisabled} subLabel={auth.authenticated ? `${followingCount} 人` : undefined} /></div>
          <div className="nav-card-enter"><NavCard icon={Users} label="粉丝" to="/follower" disabled={followsDisabled} subLabel={auth.authenticated ? `${followerCount} 人` : undefined} /></div>

          <div className="nav-card-enter"><NavCard icon={Github} label="賞個star喵" href={repoUrl} external /></div>
          <div className="nav-card-enter"><NavCard icon={Download} label="Android" href={androidUrl} external /></div>
        </div>
      </main>
    </div>
  );
}
