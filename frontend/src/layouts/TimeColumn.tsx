import { createPortal } from 'react-dom';
import { ArrowDownUp } from 'lucide-react';
import type { TimelineMonth } from '../types/image';
import { useTranslation } from '../hooks/useTranslation';

interface TimeColumnProps {
  activeMonth: TimelineMonth | null;
  months: TimelineMonth[];
  open: boolean;
  onJump: (month: TimelineMonth) => void;
  onToggleOrder: () => void;
  order: 'desc' | 'asc';
}

export function TimeColumn({ activeMonth, months, onJump, onToggleOrder, open, order }: TimeColumnProps) {
  const { t } = useTranslation();

  const content = (
    <aside
      className={`fixed right-0 top-0 z-[220] flex h-screen w-[5.5rem] flex-col overflow-x-hidden bg-[var(--page-bg-soft)] px-3 py-6 shadow-[var(--timeline-shadow)] transition-transform duration-300 ease-in-out md:w-24 md:px-4 ${
        open ? 'translate-x-0' : 'pointer-events-none translate-x-full'
      }`}
    >
      <div className="-mx-3 flex shrink-0 justify-center bg-[var(--page-bg-soft)] px-3 pb-2 pt-1 text-center md:-mx-4 md:px-4">
        <button
          aria-label={order === 'asc' ? t('tooltips.timeOrderAsc') : t('tooltips.timeOrderDesc')}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--panel-border)] text-[var(--text-main)] transition hover:text-[var(--text-accent)]"
          onClick={onToggleOrder}
          title={order === 'asc' ? t('tooltips.timeOrderAsc') : t('tooltips.timeOrderDesc')}
          type="button"
        >
          <ArrowDownUp className={order === 'asc' ? 'rotate-180' : ''} size={18} />
        </button>
      </div>
      <div className="flex-1 min-h-0 space-y-3 overflow-y-auto pt-2 text-center" style={{ scrollbarWidth: 'none' }}>
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
                <span className="text-base text-soft">{t('time.monthUnit')}</span>
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );

  if (typeof document === 'undefined') {
    return content;
  }

  return createPortal(content, document.body);
}
