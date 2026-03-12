import { ArrowLeft, CalendarRange } from 'lucide-react';
import { HomeButton } from './HomeButton';
import { ThemeButton } from './ThemeButton';

interface AlbumHeaderProps {
  title: string;
  subtitle?: string;
  theme: 'dark' | 'light';
  onBack: () => void;
  onThemeToggle: () => void;
  onTimelineToggle?: () => void;
  timelineOpen?: boolean;
  showTimeline?: boolean;
}

export function AlbumHeader({
  title,
  subtitle,
  theme,
  onBack,
  onThemeToggle,
  onTimelineToggle,
  timelineOpen = false,
  showTimeline = false,
}: AlbumHeaderProps) {
  return (
    <header className="fixed left-0 right-0 top-0 z-40 px-3 pt-3">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <button
          aria-label="返回"
          className="inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition hover:text-[var(--text-accent)] active:scale-95"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft size={22} />
        </button>

        <div className="flex flex-1 flex-col items-center">
          <p className="text-base font-semibold text-[var(--text-main)]">{title}</p>
          {subtitle ? <p className="text-xs text-soft">{subtitle}</p> : null}
        </div>

        <div className="flex items-center gap-0">
          <HomeButton />
          <ThemeButton onToggle={onThemeToggle} theme={theme} />
          {showTimeline && onTimelineToggle ? (
            <div
              className={`transition-all duration-300 ${timelineOpen ? 'pointer-events-none scale-75 opacity-0' : 'opacity-100'}`}
            >
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
          ) : null}
        </div>
      </div>
    </header>
  );
}
