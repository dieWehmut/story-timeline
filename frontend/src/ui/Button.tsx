import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  block?: boolean;
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-cyan-400/90 text-slate-950 hover:bg-cyan-300 disabled:bg-cyan-950/40 disabled:text-slate-400',
  secondary:
    'border border-white/15 bg-white/8 text-[var(--text-main)] hover:bg-white/12 disabled:border-white/5 disabled:text-slate-500',
  ghost: 'bg-transparent text-[var(--text-main)] hover:bg-white/8 disabled:text-slate-500',
};

export function Button({
  block = false,
  children,
  className = '',
  type = 'button',
  variant = 'primary',
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition duration-200 disabled:cursor-not-allowed ${variantClasses[variant]} ${
        block ? 'w-full' : ''
      } ${className}`}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}