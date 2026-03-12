import { BookOpen, Download, Github, Image as ImageIcon, LogIn, LogOut, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ThemeButton } from '../layouts/ThemeButton';
import { useAuth } from '../hooks/useAuth';
import { useImages } from '../hooks/useImages';

interface HomeProps {
  auth: ReturnType<typeof useAuth>;
  images: ReturnType<typeof useImages>;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
}

interface NavCardProps {
  icon: typeof BookOpen;
  label: string;
  to?: string;
  href?: string;
  external?: boolean;
}

function NavCard({ icon: Icon, label, to, href, external }: NavCardProps) {
  const baseClass =
    'group flex h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] text-[var(--text-main)] shadow-[var(--panel-shadow)] transition hover:-translate-y-0.5 hover:border-[var(--text-accent)]';

  if (to) {
    return (
      <Link className={baseClass} to={to}>
        <Icon className="text-cyan-300 transition group-hover:text-[var(--text-accent)]" size={26} />
        <span className="text-sm">{label}</span>
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
      <Icon className="text-cyan-300 transition group-hover:text-[var(--text-accent)]" size={26} />
      <span className="text-sm">{label}</span>
    </a>
  );
}

export default function Home({ auth, images, theme, onThemeToggle }: HomeProps) {
  const githubOwner = images.stats.githubOwner || auth.user?.login || 'GitHub';
  const repoUrl = `https://github.com/${githubOwner}/story-timeline`;
  const androidUrl = `${repoUrl}/releases/latest`;

  return (
    <div className="min-h-screen pb-28">
      <header className="px-4 pt-4">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            {auth.loading ? (
              <button
                className="inline-flex items-center gap-2 rounded-full border border-[var(--panel-border)] px-3 py-1.5 text-sm text-soft"
                disabled
                type="button"
              >
                <UserRound size={16} />
                载入中
              </button>
            ) : auth.user ? (
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
                onClick={auth.login}
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

      <main className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pt-16 text-center">
        <h1 className="font-serif text-4xl font-semibold tracking-wide text-[var(--text-main)] md:text-5xl">物语集</h1>
        <p className="mt-3 text-sm text-soft">
          注册用户数统计：{images.stats.userCount}
        </p>

        <div className="mt-10 grid w-full max-w-xl grid-cols-2 gap-4">
          <NavCard icon={BookOpen} label="物语" to="/story" />
          <NavCard icon={ImageIcon} label="相册" to="/album" />
          <NavCard icon={Github} label="代码仓库 GitHub" href={repoUrl} external />
          <NavCard icon={Download} label="Android 下载" href={androidUrl} external />
        </div>
      </main>
    </div>
  );
}
