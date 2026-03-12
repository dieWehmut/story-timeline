import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp } from 'lucide-react';
import { getUIFlags, subscribeUIFlags } from '../lib/uiFlags';

interface FloatingActionsProps {
  hidden?: boolean;
}

export function FloatingActions({ hidden = false }: FloatingActionsProps) {
  const [visible, setVisible] = useState(false);
  const [uiFlags, setUiFlags] = useState(getUIFlags());
  const [footerHeight, setFooterHeight] = useState(0);

  useEffect(() => {
    const getScrollTop = () =>
      window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;

    const handleScroll = () => {
      setVisible(getScrollTop() > 40);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => subscribeUIFlags(setUiFlags), []);

  useEffect(() => {
    const footer = document.querySelector('footer');
    if (!footer) {
      setFooterHeight(0);
      return;
    }

    const update = () => {
      const rect = footer.getBoundingClientRect();
      setFooterHeight(rect.height);
    };

    update();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => update());
      ro.observe(footer);
      return () => ro.disconnect();
    }

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  if (!visible || hidden || uiFlags.postDialogOpen || uiFlags.commentInputActive) return null;

  const iconBtnCls =
    'inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95';

  const bottomPx = footerHeight > 0 ? Math.round(footerHeight + 12) : 64;

  const container = (
    <div className="fixed right-2 z-[220]" style={{ bottom: `calc(${bottomPx}px + env(safe-area-inset-bottom))` }}>
      <button
        aria-label="返回顶部"
        className={iconBtnCls}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        type="button"
      >
        <ArrowUp size={24} />
      </button>
    </div>
  );

  if (typeof document === 'undefined') {
    return container;
  }

  return createPortal(container, document.body);
}
