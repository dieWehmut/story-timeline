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

  return (
    <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6">
      <button
        aria-label="回到顶部"
        className="floating-btn inline-flex h-10 w-10 items-center justify-center rounded-full transition hover:scale-105 active:scale-95"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        type="button"
      >
        <ArrowUp size={20} />
      </button>
    </div>
  );
}
