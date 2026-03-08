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
      className="floating-btn h-12 w-12 rounded-xl p-0 transition-all duration-300 hover:-translate-y-0.5 hover:scale-105 active:scale-95"
      onClick={onToggle}
      variant="ghost"
    >
      {theme === 'dark' ? <SunMedium size={30} /> : <MoonStar size={30} />}
    </Button>
  );
}