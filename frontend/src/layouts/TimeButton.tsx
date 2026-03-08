import { CalendarRange } from 'lucide-react';
import { Button } from '../ui/Button';

interface TimeButtonProps {
  open: boolean;
  onToggle: () => void;
}

export function TimeButton({ onToggle, open }: TimeButtonProps) {
  return (
    <Button
      aria-expanded={open}
      aria-label="切换时间列"
      className="h-10 w-10 rounded-full p-0 text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-cyan-300 active:scale-95"
      onClick={onToggle}
      variant="ghost"
    >
      <CalendarRange size={20} />
    </Button>
  );
}