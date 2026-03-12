import { Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface HomeButtonProps {
  className?: string;
}

export function HomeButton({ className }: HomeButtonProps) {
  const navigate = useNavigate();

  return (
    <button
      aria-label="返回首页"
      className={
        className ??
        'inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95'
      }
      onClick={() => {
        navigate('/');
      }}
      type="button"
    >
      <Home size={22} />
    </button>
  );
}
