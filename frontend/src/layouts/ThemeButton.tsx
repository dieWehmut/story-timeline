import { MoonStar, SunMedium } from 'lucide-react';
import { Button } from '../ui/Button';

interface ThemeButtonProps {
  theme: 'dark' | 'light';
  onToggle: () => void;
}

export function ThemeButton({ theme, onToggle }: ThemeButtonProps) {
  return (
    <Button
      aria-label="切换主题"
      className="h-12 w-12 rounded-2xl border border-white/10 bg-[var(--button-bg)] p-0 hover:bg-[var(--button-hover)]"
      onClick={onToggle}
      variant="ghost"
    >
      {theme === 'dark' ? <SunMedium size={18} /> : <MoonStar size={18} />}
    </Button>
  );
}