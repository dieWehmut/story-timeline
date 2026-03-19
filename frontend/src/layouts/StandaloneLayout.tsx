import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

/**
 * 独立页面的布局组件（用于 Login、Register、Config 等不在 AppLayout 内的页面）
 * 提供 View Transitions API 支持的页面过渡动画
 */
export function StandaloneLayout() {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const [transitionKey, setTransitionKey] = useState(0);

  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;

      if ('startViewTransition' in document) {
        document.startViewTransition(() => {
          setTransitionKey((k) => k + 1);
        });
      } else {
        setTransitionKey((k) => k + 1);
      }
    }
  }, [location.pathname]);

  return (
    <div className="page-content min-h-screen" key={transitionKey}>
      <Outlet />
    </div>
  );
}
