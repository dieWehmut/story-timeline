import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export function FloatingActions() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 40);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!visible) return null;

  const iconBtnCls =
    'inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95';

  return (
    <div className="fixed bottom-1 right-1 z-50">
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
