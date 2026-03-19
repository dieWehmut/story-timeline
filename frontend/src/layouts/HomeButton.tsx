import { Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';

interface HomeButtonProps {
  className?: string;
}

export function HomeButton({ className }: HomeButtonProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <button
      aria-label={t('tooltips.homeButton')}
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
