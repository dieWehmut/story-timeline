import { createContext } from 'react';

export interface ToastContextValue {
  toast: (message: string, type?: 'info' | 'success' | 'error') => void;
  confirm: (message: string, onConfirm: () => void) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
