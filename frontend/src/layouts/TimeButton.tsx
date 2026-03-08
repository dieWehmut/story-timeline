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
      className="glass-panel rounded-2xl px-4 py-3 text-sm font-medium"
      onClick={onToggle}
      variant="ghost"
    >
      <CalendarRange size={16} />
      时间跳转
    </Button>
  );
}