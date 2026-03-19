import { useTranslation } from '../hooks/useTranslation';

interface FollowButtonProps {
  following: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}

export function FollowButton({ following, disabled, onClick, className }: FollowButtonProps) {
  const { t } = useTranslation();
  const base =
    'follow-btn inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs transition';
  const stateClass = following
    ? 'border-rose-400/40 text-rose-300 hover:border-rose-300 hover:text-rose-200'
    : 'border-cyan-400/40 text-cyan-300 hover:border-cyan-300 hover:text-cyan-200';

  return (
    <button
      className={`${base} ${stateClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className ?? ''}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {following ? t('social.unfollowAction') : t('social.followAction')}
    </button>
  );
}
