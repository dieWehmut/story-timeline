import { useEffect, useRef, useState } from 'react';
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
  const prevPathRef = useRef(location.pathname);
  const [transitionKey, setTransitionKey] = useState(0);

  useEffect(() => subscribeUIFlags(setUiFlags), []);

  // 检测路由变化并触发过渡动画
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      // 设置过渡方向
      const direction = getTransitionDirection(prevPathRef.current, location.pathname);
      document.documentElement.dataset.transitionDirection = direction;
      prevPathRef.current = location.pathname;

      // 使用 View Transitions API（如果支持）
      if ('startViewTransition' in document) {
        document.startViewTransition(() => {
          setTransitionKey((k) => k + 1);
        });
      } else {
        setTransitionKey((k) => k + 1);
      }
    }
  }, [location.pathname]);

  const hideFooter =
    uiFlags.commentInputActive ||
    location.pathname.startsWith('/album') ||
    location.pathname.startsWith('/post') ||
    location.pathname.startsWith('/story/');

  return (
    <div className="min-h-screen">
      <div className="page-content" key={transitionKey}>
        <Outlet />
      </div>
      {hideFooter ? null : <Footer stats={footerStats} />}
    </div>
  );
}

/**
 * 根据导航路径判断过渡方向
 */
function getTransitionDirection(from: string, to: string): 'forward' | 'backward' | 'same' {
  const hierarchy: Record<string, number> = {
    '/': 0,
    '/story': 1,
    '/album': 1,
    '/following': 1,
    '/follower': 1,
    '/post': 2,
    '/config': 2,
  };

  const fromBase = '/' + (from.split('/')[1] || '');
  const toBase = '/' + (to.split('/')[1] || '');

  const fromLevel = hierarchy[fromBase] ?? 1;
  const toLevel = hierarchy[toBase] ?? 1;

  if (toLevel > fromLevel) return 'forward';
  if (toLevel < fromLevel) return 'backward';
  return 'same';
}
