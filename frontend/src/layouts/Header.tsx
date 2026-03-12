import { ArrowLeft, CalendarRange } from 'lucide-react';
import { ThemeButton } from './ThemeButton';
import { AuthButton } from './AuthButton';
import { HomeButton } from './HomeButton';
import { UploadButton } from './UploadButton';
import { TagBar } from './TagBar';
import { UserBar } from './UserBar';
import type { AuthUser, FeedUser, TimelineMonth } from '../types/image';

interface HeaderProps {
  activeMonth: TimelineMonth | null;
  authAuthenticated: boolean;
  authLoading: boolean;
  authUser: AuthUser | null;
  canPost: boolean;
  feedUsers: FeedUser[];
  filterUser: string | null;
  isDetailView?: boolean;
  onBack?: () => void;
  onFilterUser: (login: string | null) => void;
  onLogin: () => void;
  onLogout: () => Promise<void>;
  onTagSelect: (tag: string | null) => void;
  onThemeToggle: () => void;
  onTimelineToggle: () => void;
  tagFilter: string | null;
  tagSummary: { tag: string; count: number }[];
  theme: 'dark' | 'light';
  timelineOpen: boolean;
  uploadBusy: boolean;
}

export function Header({
  activeMonth,
  authAuthenticated,
  authLoading,
  authUser,
  canPost,
  feedUsers,
  filterUser,
  isDetailView,
  onBack,
  onFilterUser,
  onLogin,
  onLogout,
  onTagSelect,
  onThemeToggle,
  onTimelineToggle,
  tagFilter,
  tagSummary,
  theme,
  timelineOpen,
  uploadBusy,
}: HeaderProps) {
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
                <p className="text-sm font-medium text-[var(--text-main)]">{authUser.login}</p>
              ) : null}
            </>
          )}
        </div>
        <div className="flex items-center gap-0">
          {isDetailView ? (
            <ThemeButton onToggle={onThemeToggle} theme={theme} />
          ) : (
            <>
              <HomeButton />
              <AuthButton authenticated={authAuthenticated} loading={authLoading} onLogin={onLogin} onLogout={onLogout} user={authUser} />
              <ThemeButton onToggle={onThemeToggle} theme={theme} />
              {authUser && canPost ? <UploadButton busy={uploadBusy} /> : null}
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
