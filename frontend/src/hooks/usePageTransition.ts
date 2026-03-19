import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, type NavigateOptions } from 'react-router-dom';

/**
 * 支持 View Transitions API 的页面导航 hook
 * 为页面切换提供流畅的过渡动画
 */
export function usePageTransition() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevPathRef = useRef(location.pathname);

  // 检测是否支持 View Transitions API
  const supportsViewTransitions = typeof document !== 'undefined' && 'startViewTransition' in document;

  // 带过渡动画的导航函数
  const navigateWithTransition = useCallback(
    (to: string, options?: NavigateOptions) => {
      if (!supportsViewTransitions) {
        navigate(to, options);
        return;
      }

      setIsTransitioning(true);

      document.startViewTransition(() => {
        navigate(to, options);
        return new Promise<void>((resolve) => {
          // 等待 React 完成渲染
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve();
            });
          });
        });
      }).finished.finally(() => {
        setIsTransitioning(false);
      });
    },
    [navigate, supportsViewTransitions]
  );

  // 监听路由变化来设置过渡方向
  useEffect(() => {
    const prevPath = prevPathRef.current;
    const currentPath = location.pathname;

    if (prevPath !== currentPath) {
      // 设置过渡方向（用于不同的动画效果）
      const direction = getTransitionDirection(prevPath, currentPath);
      document.documentElement.dataset.transitionDirection = direction;
      prevPathRef.current = currentPath;
    }
  }, [location.pathname]);

  return {
    navigateWithTransition,
    isTransitioning,
    supportsViewTransitions,
  };
}

/**
 * 根据导航路径判断过渡方向
 */
function getTransitionDirection(from: string, to: string): 'forward' | 'backward' | 'same' {
  // 页面层级映射（数字越小层级越高）
  const hierarchy: Record<string, number> = {
    '/': 0,
    '/story': 1,
    '/album': 1,
    '/following': 1,
    '/follower': 1,
    '/post': 2,
    '/config': 2,
    '/login': 0,
    '/register': 0,
  };

  // 获取基础路径
  const fromBase = '/' + (from.split('/')[1] || '');
  const toBase = '/' + (to.split('/')[1] || '');

  const fromLevel = hierarchy[fromBase] ?? 1;
  const toLevel = hierarchy[toBase] ?? 1;

  if (toLevel > fromLevel) {
    return 'forward';
  } else if (toLevel < fromLevel) {
    return 'backward';
  }
  return 'same';
}

/**
 * 简单的页面过渡包装组件 props
 */
export interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}
