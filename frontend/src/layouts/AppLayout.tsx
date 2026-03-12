import { Outlet, useLocation } from 'react-router-dom';
import { Footer } from './Footer';
import type { HealthStats } from '../types/image';

interface AppLayoutProps {
  footerStats: HealthStats;
}

export function AppLayout({ footerStats }: AppLayoutProps) {
  const location = useLocation();
  const hideFooter = location.pathname.startsWith('/album');

  return (
    <div className="min-h-screen">
      <Outlet />
      {hideFooter ? null : <Footer stats={footerStats} />}
    </div>
  );
}
