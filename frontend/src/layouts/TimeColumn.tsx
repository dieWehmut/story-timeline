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
      className={`fixed right-0 top-0 z-40 h-screen w-[5.5rem] overflow-y-auto overflow-x-hidden bg-[#0f1218] px-3 py-8 shadow-[-16px_0_48px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-in-out md:w-24 md:px-4 ${
        open ? 'translate-x-0' : 'pointer-events-none translate-x-full'
      }`}
      style={{ scrollbarWidth: 'none' }}
    >
      <div className="space-y-4 pt-4 text-center">
        {months.map((month, index) => {
          const previous = months[index - 1];
          const showYear = !previous || previous.year !== month.year;
          const active = activeMonth?.key === month.key;

          return (
            <div key={month.key}>
              {showYear ? (
                <p className={`mb-2 text-[0.65rem] font-bold uppercase tracking-widest ${
                  active ? 'text-cyan-400' : 'text-slate-400'
                }`}>
                  {month.year}
                </p>
              ) : null}
              <button
                className={`flex w-full items-end justify-center gap-1 font-light leading-none transition-all duration-200 hover:text-cyan-300 ${
                  active ? 'text-cyan-400' : 'text-slate-200'
                }`}
                onClick={() => onJump(month)}
                type="button"
              >
                <span className="text-4xl tracking-tight">{month.month}</span>
                <span className="text-base text-slate-400">月</span>
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}