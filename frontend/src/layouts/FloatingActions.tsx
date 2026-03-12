import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { getUIFlags, subscribeUIFlags } from '../lib/uiFlags';

interface FloatingActionsProps {
  hidden?: boolean;
}

export function FloatingActions({ hidden = false }: FloatingActionsProps) {
  const [visible, setVisible] = useState(false);
  const [uiFlags, setUiFlags] = useState(getUIFlags());

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 40);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => subscribeUIFlags(setUiFlags), []);

  if (!visible || hidden || uiFlags.postDialogOpen || uiFlags.commentInputActive) return null;

  const iconBtnCls =
    'inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95';

  return (
    <div className="fixed bottom-2 right-2 z-50">
      <button
        aria-label="回到顶部"
        className={iconBtnCls}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        type="button"
      >
        <ArrowUp size={24} />
      </button>
    </div>
  );
}
