import { ArrowLeft, CalendarRange } from 'lucide-react';
import { ThemeButton } from './ThemeButton';
import { AuthButton } from './AuthButton';
import { HomeButton } from './HomeButton';
import { SettingsButton } from './SettingsButton';
import { UploadButton } from './UploadButton';
import { TagBar } from './TagBar';
import { UserBar } from './UserBar';
import { useProfile } from '../context/ProfileContext';
import type { AuthUser, FeedUser, TimelineMonth } from '../types/image';

interface HeaderProps {
  activeMonth: TimelineMonth | null;
  authAuthenticated: boolean;
  authLoading: boolean;
  authLoginUrl?: string;
  authGoogleLoginUrl?: string;
  authEmailLoginUrl?: string;
  authUser: AuthUser | null;
  canPost: boolean;
  feedUsers: FeedUser[];
  filterUser: string | null;
  isDetailView?: boolean;
  onBack?: () => void;
  onFilterUser: (login: string | null) => void;
  onLogin: (provider: 'github' | 'google') => void;
  onEmailLogin?: (email: string) => Promise<void> | void;
  onLogout: () => Promise<void>;
  emailPolling?: boolean;
  onTagSelect: (tag: string | null) => void;
  onThemeToggle: () => void;
  onTimelineToggle: () => void;
  tagFilter: string | null;
  tagSummary: { tag: string; count: number }[];
  theme: 'dark' | 'light';
  timelineOpen: boolean;
  uploadBusy: boolean;
  showUploadButton?: boolean;
}

export function Header({
  activeMonth,
  authAuthenticated,
  authLoading,
  authLoginUrl,
  authGoogleLoginUrl,
  authEmailLoginUrl,
  authUser,
  canPost,
  feedUsers,
  filterUser,
  isDetailView,
  onBack,
  onFilterUser,
  onLogin,
  onEmailLogin,
  onLogout,
  emailPolling,
  onTagSelect,
  onThemeToggle,
  onTimelineToggle,
  tagFilter,
  tagSummary,
  theme,
  timelineOpen,
  uploadBusy,
  showUploadButton = true,
}: HeaderProps) {
  const profile = useProfile();
  const displayName = authUser ? profile.resolveName(authUser.login) : '';
  return (
    <header className="fixed left-0 right-0 top-0 z-40 px-2 pt-2 md:px-3 md:pt-3">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <div className="flex items-center gap-3">
          {isDetailView ? (
            <button
              aria-label="返回"
              className="inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition hover:text-[var(--text-accent)] active:scale-95"
              onClick={onBack}
              type="button"
            >
              <ArrowLeft size={22} />
            </button>
          ) : (
            <>
              <p className="font-serif text-xl font-semibold leading-none text-accent md:text-2xl">
                {activeMonth ? `${activeMonth.year}-${String(activeMonth.month).padStart(2, '0')}` : '---- --'}
              </p>
              {authUser ? (
                <p className="text-sm font-medium text-[var(--text-main)]">{displayName || authUser.login}</p>
              ) : null}
            </>
          )}
        </div>
        <div className="flex items-center gap-0">
          {isDetailView ? (
            <>
              <HomeButton />
              <SettingsButton />
              {!authAuthenticated ? (
                <AuthButton
                  authenticated={authAuthenticated}
                  loading={authLoading}
                  loginUrl={authLoginUrl}
                  googleLoginUrl={authGoogleLoginUrl}
                  emailLoginUrl={authEmailLoginUrl}
                  onLogin={onLogin}
                  onEmailLogin={onEmailLogin}
                  onLogout={onLogout}
                  user={authUser}
                  emailPolling={emailPolling}
                />
              ) : null}
              <ThemeButton onToggle={onThemeToggle} theme={theme} />
            </>
          ) : (
            <>
              <HomeButton />
              <SettingsButton />
              {!authAuthenticated ? (
                <AuthButton
                  authenticated={authAuthenticated}
                  loading={authLoading}
                  loginUrl={authLoginUrl}
                  googleLoginUrl={authGoogleLoginUrl}
                  emailLoginUrl={authEmailLoginUrl}
                  onLogin={onLogin}
                  onEmailLogin={onEmailLogin}
                  onLogout={onLogout}
                  user={authUser}
                  emailPolling={emailPolling}
                />
              ) : null}
              {authUser && canPost && showUploadButton ? <UploadButton busy={uploadBusy} /> : null}
              <ThemeButton onToggle={onThemeToggle} theme={theme} />
              <div className={`transition-all duration-300 ${timelineOpen ? 'pointer-events-none scale-75 opacity-0' : 'opacity-100'}`}>
                <button
                  aria-expanded={timelineOpen}
                  aria-label="切换时间列"
                  className="inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95"
                  onClick={onTimelineToggle}
                  type="button"
                >
                  <CalendarRange size={24} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {!isDetailView ? (
        <>
          <UserBar feedUsers={feedUsers} filterUser={filterUser} onFilterUser={onFilterUser} />
          <TagBar
            className="pt-0"
            onSelect={onTagSelect}
            selectedTag={tagFilter}
            tags={tagSummary}
          />
        </>
      ) : null}
    </header>
  );
}
