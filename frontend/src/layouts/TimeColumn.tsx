import type { TimelineMonth } from '../types/image';

interface TimeColumnProps {
  activeMonth: TimelineMonth | null;
  months: TimelineMonth[];
  open: boolean;
  onJump: (month: TimelineMonth) => void;
}

export function TimeColumn({ activeMonth, months, onJump, open }: TimeColumnProps) {
  return (
    <aside
      className={`glass-panel fixed right-4 top-20 z-40 max-h-[75vh] w-32 overflow-y-auto rounded-[2rem] px-4 py-5 transition duration-300 md:right-8 ${
        open ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-8 opacity-0'
      }`}
    >
      <div className="space-y-5">
        {months.map((month, index) => {
          const previous = months[index - 1];
          const showYear = !previous || previous.year !== month.year;
          const active = activeMonth?.key === month.key;

          return (
            <div className="space-y-2" key={month.key}>
              {showYear ? (
                <p className={`text-xl font-semibold ${active ? 'text-cyan-400' : 'text-[var(--text-main)]'}`}>
                  {month.year}年
                </p>
              ) : null}
              <button
                className={`block text-left text-5xl font-light tracking-tight transition hover:text-cyan-300 ${
                  active ? 'text-cyan-400' : 'text-[var(--text-main)]'
                }`}
                onClick={() => onJump(month)}
                type="button"
              >
                <span>{month.month}</span>
                <span className="ml-1 text-2xl">月</span>
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}