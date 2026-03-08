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
      className="h-14 w-14 rounded-[1.35rem] border border-white/12 bg-[var(--button-bg)] p-0 shadow-[0_14px_30px_rgba(15,23,42,0.3)] transition-all duration-300 hover:-translate-y-1 hover:scale-105 hover:bg-[var(--button-hover)] hover:shadow-[0_18px_38px_rgba(34,211,238,0.22)] active:scale-95"
      onClick={onToggle}
      variant="ghost"
    >
      {theme === 'dark' ? <SunMedium className="transition-transform duration-300 hover:rotate-12" size={20} /> : <MoonStar className="transition-transform duration-300 hover:-rotate-12" size={20} />}
    </Button>
  );
}