import { ArrowLeft, ArrowDownUp } from 'lucide-react';
import { HomeButton } from './HomeButton';
import { ThemeButton } from './ThemeButton';

interface AlbumHeaderProps {
  title: string;
  subtitle?: string;
  theme: 'dark' | 'light';
  onBack: () => void;
  onThemeToggle: () => void;
  onToggleSort?: () => void;
  sortOrder?: 'asc' | 'desc';
  showSort?: boolean;
}

export function AlbumHeader({
  title,
  subtitle,
  theme,
  onBack,
  onThemeToggle,
  onToggleSort,
  sortOrder,
  showSort = false,
}: AlbumHeaderProps) {
  const sortLabel = sortOrder === 'asc' ? '时间升序' : '时间降序';

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
          {showSort && onToggleSort ? (
            <button
              aria-label="切换时间排序"
              className="inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95"
              onClick={onToggleSort}
              title={sortLabel}
              type="button"
            >
              <ArrowDownUp size={22} />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
