import { MoonStar, SunMedium } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

interface ThemeButtonProps {
  theme: 'dark' | 'light';
  onToggle: () => void;
}

const iconBtnCls =
  'inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95';

export function ThemeButton({ theme, onToggle }: ThemeButtonProps) {
  const { t } = useTranslation();

  return (
    <button aria-label={t('tooltips.themeSwitcher')} className={iconBtnCls} onClick={onToggle} type="button">
      {theme === 'dark' ? <SunMedium size={24} /> : <MoonStar size={24} />}
    </button>
  );
}
