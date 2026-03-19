import type { ReactNode } from 'react';

interface PageWrapperProps {
  children: ReactNode;
  className?: string;
}

/**
 * 为独立页面（不在 AppLayout 内的页面）提供过渡动画的包装组件
 */
export function PageWrapper({ children, className = '' }: PageWrapperProps) {
  return (
    <div className={`page-content min-h-screen ${className}`}>
      {children}
    </div>
  );
}
