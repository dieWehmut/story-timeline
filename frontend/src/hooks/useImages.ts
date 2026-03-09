import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type {
  CreateImagePayload,
  FeedUser,
  HealthStats,
  ImageItem,
  TimelineMonth,
  UpdateImagePayload,
} from '../types/image';

const beijingFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: 'numeric',
});

const getMonthKey = (capturedAt: string) => {
  const date = new Date(capturedAt);
  const parts = beijingFormatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value ?? '0');
  const month = Number(parts.find((part) => part.type === 'month')?.value ?? '0');

  return {
    key: `${year}-${String(month).padStart(2, '0')}`,
    year,
    month,
  };
};

const defaultStats: HealthStats = {
  userCount: 0,
  onlineUsers: 0,
  uptimeSeconds: 0,
  githubOwner: 'GitHub',
};

export const useImages = () => {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [feedUsers, setFeedUsers] = useState<FeedUser[]>([]);
  const [filterUser, setFilterUser] = useState<string | null>(null);
  const [stats, setStats] = useState<HealthStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const [nextItems, nextStats, nextUsers] = await Promise.all([
          api.getFeed(),
          api.getStats(),
          api.getFeedUsers(),
        ]);

        if (cancelled) {
          return;
        }

        setItems(
          [...nextItems].sort(
            (left, right) => new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime()
          )
        );
        setStats(nextStats);
        setFeedUsers(nextUsers);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '加载失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void bootstrap();

    const pingTimer = window.setInterval(() => {
      void api.pingStats().catch(() => undefined);
      void api.getStats().then(setStats).catch(() => undefined);
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(pingTimer);
    };
  }, []);

  // Filter items by selected user
  const filteredItems = useMemo(() => {
    if (!filterUser) return items;
    return items.filter(
      (item) => item.authorLogin.toLowerCase() === filterUser.toLowerCase()
    );
  }, [items, filterUser]);

  const timeline = useMemo<TimelineMonth[]>(() => {
    const monthMap = new Map<string, TimelineMonth>();

    filteredItems.forEach((item) => {
      const month = getMonthKey(item.capturedAt);
      const existing = monthMap.get(month.key);

      if (existing) {
        existing.count += 1;
        return;
      }

      monthMap.set(month.key, {
        ...month,
        label: `${month.year}年 ${month.month}月`,
        count: 1,
      });
    });

    return [...monthMap.values()].sort((left, right) => right.key.localeCompare(left.key));
  }, [filteredItems]);

  const createImage = async (payload: CreateImagePayload) => {
    setSubmitting(true);
    setError(null);

    try {
      const created = await api.createImage(payload);
      setItems((currentItems) =>
        [created, ...currentItems].sort(
          (left, right) => new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime()
        )
      );
      // Refresh feed users in case this is a new user
      api.getFeedUsers().then(setFeedUsers).catch(() => undefined);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '上传失败');
      throw submitError;
    } finally {
      setSubmitting(false);
    }
  };

  const updateImage = async (payload: UpdateImagePayload) => {
    setSubmitting(true);
    setError(null);

    try {
      const updated = await api.updateImage(payload);
      setItems((currentItems) =>
        currentItems
          .map((item) => (item.id === updated.id ? updated : item))
          .sort((left, right) => new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime())
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '更新失败');
      throw submitError;
    } finally {
      setSubmitting(false);
    }
  };

  const deleteImage = async (id: string) => {
    setSubmitting(true);
    setError(null);

    try {
      await api.deleteImage(id);
      setItems((currentItems) => currentItems.filter((item) => item.id !== id));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '删除失败');
      throw submitError;
    } finally {
      setSubmitting(false);
    }
  };

  return {
    items: filteredItems,
    allItems: items,
    feedUsers,
    filterUser,
    setFilterUser,
    timeline,
    stats,
    loading,
    submitting,
    error,
    createImage,
    updateImage,
    deleteImage,
  };
};