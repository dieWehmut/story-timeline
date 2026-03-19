import { useTranslation } from '../hooks/useTranslation';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5 text-[var(--text-main)] shadow-xl backdrop-blur-xl">
        <p className="mb-3 text-sm font-medium">{title}</p>
        <p className="mb-5 text-xs text-soft">{message}</p>
        <div className="flex gap-3">
          <button
            className="flex-1 rounded-full border border-[var(--panel-border)] px-3 py-2 text-xs transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)]"
            onClick={onConfirm}
            type="button"
          >
            {confirmText ?? t('common.confirm')}
          </button>
          <button
            className="flex-1 rounded-full border border-[var(--panel-border)] px-3 py-2 text-xs text-soft transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)]"
            onClick={onCancel}
            type="button"
          >
            {cancelText ?? t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
