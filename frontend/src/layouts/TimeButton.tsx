import { CalendarRange } from 'lucide-react';

interface TimeButtonProps {
  open: boolean;
  onToggle: () => void;
}

export function TimeButton({ onToggle, open }: TimeButtonProps) {
  return (
    <button
      aria-expanded={open}
      aria-label="切换时间列"
      className="inline-flex items-center justify-center p-0 text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95"
      onClick={onToggle}
      type="button"
    >
      <CalendarRange size={28} />
    </button>
  );
}