import { Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';

const iconBtnCls =
  'inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95';

export function SettingsButton() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <button
      aria-label={t('tooltips.settingsButton')}
      className={iconBtnCls}
      onClick={() => navigate('/config')}
      type="button"
    >
      <Settings size={22} />
    </button>
  );
}
