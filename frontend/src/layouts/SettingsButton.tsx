import { Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const iconBtnCls =
  'inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95';

export function SettingsButton() {
  const navigate = useNavigate();

  return (
    <button
      aria-label="设置"
      className={iconBtnCls}
      onClick={() => navigate('/config')}
      type="button"
    >
      <Settings size={22} />
    </button>
  );
}
