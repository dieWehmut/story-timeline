import { ArrowDownUp } from 'lucide-react';
import type { TimelineMonth } from '../types/image';

interface TimeColumnProps {
  activeMonth: TimelineMonth | null;
  months: TimelineMonth[];
  open: boolean;
  onJump: (month: TimelineMonth) => void;
  onToggleOrder: () => void;
  order: 'desc' | 'asc';
}

export function TimeColumn({ activeMonth, months, onJump, onToggleOrder, open, order }: TimeColumnProps) {
  return (
    <aside
      className={`fixed right-0 top-0 z-40 h-screen w-[5.5rem] overflow-y-auto overflow-x-hidden bg-[var(--page-bg-soft)] px-3 py-6 shadow-[var(--timeline-shadow)] transition-transform duration-300 ease-in-out md:w-24 md:px-4 ${
        open ? 'translate-x-0' : 'pointer-events-none translate-x-full'
      }`}
      style={{ scrollbarWidth: 'none' }}
    >
      <div className="sticky top-0 z-10 -mx-3 flex justify-center bg-[var(--page-bg-soft)] px-3 pb-2 pt-1 text-center md:-mx-4 md:px-4">
        <button
          aria-label="切换时间排序"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--panel-border)] text-[var(--text-main)] transition hover:text-[var(--text-accent)]"
          onClick={onToggleOrder}
          title={order === 'asc' ? '时间排序：旧到新' : '时间排序：新到旧'}
          type="button"
        >
          <ArrowDownUp className={order === 'asc' ? 'rotate-180' : ''} size={18} />
        </button>
      </div>
      <div className="space-y-3 pt-2 text-center">
        {months.map((month, index) => {
          const previous = months[index - 1];
          const showYear = !previous || previous.year !== month.year;
          const active = activeMonth?.key === month.key;

          return (
            <div key={month.key}>
              {showYear ? (
                <p className={`mb-2 text-[0.65rem] font-bold uppercase tracking-widest ${
                  active ? 'text-[var(--text-accent)]' : 'text-soft'
                }`}>
                  {month.year}
                </p>
              ) : null}
              <button
                className={`flex w-full items-end justify-center gap-1 font-light leading-none transition-all duration-200 hover:text-[var(--text-accent)] ${
                  active ? 'text-[var(--text-accent)]' : 'text-[var(--text-main)]'
                }`}
                onClick={() => onJump(month)}
                type="button"
              >
                <span className="text-4xl tracking-tight">{month.month}</span>
                <span className="text-base text-soft">月</span>
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
