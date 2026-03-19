import { useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { ToastContext } from '../utils/ToastContext';
import { useTranslation } from '../hooks/useTranslation';

interface ToastItem {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'confirm';
  onConfirm?: () => void;
  onCancel?: () => void;
}

let nextId = 0;

function ToastMessage({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  useEffect(() => {
    if (item.type === 'confirm') return;
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(item.id), 200);
    }, 2400);
    return () => clearTimeout(timer);
  }, [item, onDismiss]);

  const bgClass =
    item.type === 'error'
      ? 'bg-rose-600/90'
      : item.type === 'success'
        ? 'bg-emerald-600/90'
        : item.type === 'confirm'
          ? 'bg-[var(--panel-bg)] border border-[var(--panel-border)]'
          : 'bg-slate-700/90';

  if (item.type === 'confirm') {
    const dismissConfirm = () => {
      item.onCancel?.();
      setVisible(false);
      setTimeout(() => onDismiss(item.id), 200);
    };

    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 pointer-events-auto"
        onClick={dismissConfirm}
      >
        <div
          className={`w-72 rounded-lg bg-[var(--panel-bg)] border border-[var(--panel-border)] px-5 py-4 text-sm text-[var(--text-main)] backdrop-blur-xl shadow-xl transition-all duration-200 ${
            visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <p className="text-center">{item.message}</p>
          <div className="mt-4 flex justify-center gap-4">
            <button
              className="px-4 py-1.5 text-sm text-soft hover:text-[var(--text-main)] transition"
            onClick={() => {
                dismissConfirm();
              }}
              type="button"
            >
              {t('common.cancel')}
            </button>
            <button
              className="px-4 py-1.5 text-sm rounded bg-rose-600 text-white hover:bg-rose-500 font-medium transition"
              onClick={() => {
                item.onConfirm?.();
                setVisible(false);
                setTimeout(() => onDismiss(item.id), 200);
              }}
              type="button"
            >
              {t('common.confirm')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`pointer-events-auto w-full max-w-sm px-4 py-3 text-sm text-[var(--text-main)] backdrop-blur-md transition-all duration-200 ${bgClass} ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      <p>{item.message}</p>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const toast = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setItems((prev) => [...prev, { id: ++nextId, message, type }]);
  }, []);

  const confirm = useCallback((message: string, onConfirm: () => void) => {
    const id = ++nextId;
    setItems((prev) => [
      ...prev,
      {
        id,
        message,
        type: 'confirm' as const,
        onConfirm,
        onCancel: () => {},
      },
    ]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-2 pointer-events-none">
        {items.map((item) => (
          <ToastMessage item={item} key={item.id} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
