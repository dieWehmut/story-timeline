import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Footer } from './Footer';
import { getUIFlags, subscribeUIFlags } from '../lib/uiFlags';
import type { HealthStats } from '../types/image';

interface AppLayoutProps {
  footerStats: HealthStats;
}

export function AppLayout({ footerStats }: AppLayoutProps) {
  const location = useLocation();
  const [uiFlags, setUiFlags] = useState(getUIFlags());

  useEffect(() => subscribeUIFlags(setUiFlags), []);

  const hideFooter =
    uiFlags.commentInputActive ||
    location.pathname.startsWith('/album') ||
    location.pathname.startsWith('/post') ||
    location.pathname.startsWith('/story/');

  return (
    <div className="min-h-screen">
      <div className="page-transition" key={location.pathname}>
        <Outlet />
      </div>
      {hideFooter ? null : <Footer stats={footerStats} />}
    </div>
  );
}
