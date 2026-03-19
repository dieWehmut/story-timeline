import { PencilLine } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';

interface UploadButtonProps {
  busy: boolean;
  variant?: 'icon' | 'card';
  disabled?: boolean;
  label?: string;
  subLabel?: string;
  showIcon?: boolean;
  className?: string;
}

const iconBtnCls =
  'inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95';

const cardBtnBase =
  'group flex w-full flex-col items-center justify-center gap-1 px-4 py-3 text-sm text-[var(--text-main)] transition';

export function UploadButton({
  busy,
  variant = 'icon',
  disabled = false,
  label,
  subLabel,
  showIcon = true,
  className,
}: UploadButtonProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isDisabled = disabled || busy;
  const resolvedLabel = label ?? t('story.record');

  const handleClick = () => {
    if (isDisabled) return;
    navigate('/post', { state: { from: `${location.pathname}${location.search}` } });
  };

  if (variant === 'card') {
    return (
      <button
        aria-label={resolvedLabel}
        className={`${cardBtnBase} ${className ?? ''} ${isDisabled ? 'cursor-not-allowed opacity-50' : 'hover:text-[var(--text-accent)]'}`}
        disabled={isDisabled}
        onClick={handleClick}
        type="button"
      >
        {showIcon ? (
          <PencilLine className="quick-actions-icon text-cyan-300 transition group-hover:text-[var(--text-accent)]" size={20} />
        ) : null}
        <span className="leading-none">{resolvedLabel}</span>
        {subLabel ? (
          <span className="quick-actions-sub text-xs text-soft">{subLabel}</span>
        ) : null}
      </button>
    );
  }

  return (
    <button
      aria-label={resolvedLabel}
      className={`${iconBtnCls} ${isDisabled ? 'opacity-60' : ''}`}
      disabled={isDisabled}
      onClick={handleClick}
      type="button"
    >
      <PencilLine size={24} />
    </button>
  );
}
