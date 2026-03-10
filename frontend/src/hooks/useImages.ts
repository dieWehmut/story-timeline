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

const getMonthKey = (startAt: string) => {
  const date = new Date(startAt);
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

const CACHE_KEY_FEED = 'story_feed_cache';
const CACHE_KEY_USERS = 'story_users_cache';

const sortByDate = (itemsList: ImageItem[]) =>
  [...itemsList].sort(
    (left, right) => new Date(right.startAt).getTime() - new Date(left.startAt).getTime()
  );

const normalizeCachedItem = (item: ImageItem): ImageItem => ({
  ...item,
  tags: item.tags ?? [],
});

const loadCachedFeed = (): ImageItem[] | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY_FEED);
    return raw ? (JSON.parse(raw) as ImageItem[]).map(normalizeCachedItem) : null;
  } catch {
    return null;
  }
};

const loadCachedUsers = (): FeedUser[] | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY_USERS);
    return raw ? (JSON.parse(raw) as FeedUser[]) : null;
  } catch {
    return null;
  }
};

const saveCacheFeed = (data: ImageItem[]) => {
  try { localStorage.setItem(CACHE_KEY_FEED, JSON.stringify(data)); } catch { /* quota */ }
};

const saveCacheUsers = (data: FeedUser[]) => {
  try { localStorage.setItem(CACHE_KEY_USERS, JSON.stringify(data)); } catch { /* quota */ }
};

export const useImages = () => {
  const cachedFeed = loadCachedFeed();
  const cachedUsers = loadCachedUsers();
  const [items, setItems] = useState<ImageItem[]>(cachedFeed ? sortByDate(cachedFeed) : []);
  const [feedUsers, setFeedUsers] = useState<FeedUser[]>(cachedUsers ?? []);
  const [filterUser, setFilterUser] = useState<string | null>(null);
  const [stats, setStats] = useState<HealthStats>(defaultStats);
  const [loading, setLoading] = useState(!cachedFeed);
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

        const sorted = sortByDate(nextItems);
        setItems(sorted);
        setStats(nextStats);
        setFeedUsers(nextUsers);
        saveCacheFeed(sorted);
        saveCacheUsers(nextUsers);
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
      const month = getMonthKey(item.startAt);
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

  const createImage = async (payload: CreateImagePayload, optimisticUser?: { login: string; avatarUrl: string }) => {
    setSubmitting(true);
    setError(null);

    const tempId = `temp-${Date.now()}`;
    if (optimisticUser) {
      const tempItem: ImageItem = {
        id: tempId,
        authorLogin: optimisticUser.login,
        authorAvatar: optimisticUser.avatarUrl,
        description: payload.description,
        tags: payload.tags,
        timeMode: payload.timeMode,
        startAt: payload.startAt,
        endAt: payload.endAt,
        imageUrls: payload.files.map((f) => URL.createObjectURL(f)),
        imagePaths: [],
        metadataPath: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        likeCount: 0,
        commentCount: 0,
        liked: false,
      };
      setItems((currentItems) => sortByDate([tempItem, ...currentItems]));
    }

    try {
      const created = await api.createImage(payload);
      setItems((currentItems) => {
        const next = sortByDate(
          optimisticUser
            ? currentItems.map((item) => (item.id === tempId ? created : item))
            : [created, ...currentItems]
        );
        saveCacheFeed(next);
        return next;
      });
      // Refresh feed users in case this is a new user
      api.getFeedUsers().then((users) => {
        setFeedUsers(users);
        saveCacheUsers(users);
      }).catch(() => undefined);
    } catch (submitError) {
      if (optimisticUser) {
        setItems((currentItems) => currentItems.filter((item) => item.id !== tempId));
      }
      setError(submitError instanceof Error ? submitError.message : '上传失败');
      throw submitError;
    } finally {
      setSubmitting(false);
    }
  };

  const updateImage = async (payload: UpdateImagePayload) => {
    setSubmitting(true);
    setError(null);

    let previousItem: ImageItem | undefined;
    setItems((currentItems) => {
      previousItem = currentItems.find((item) => item.id === payload.id);
      return sortByDate(
        currentItems.map((item) => {
          if (item.id !== payload.id) return item;
          return {
            ...item,
            description: payload.description,
            tags: payload.tags,
            timeMode: payload.timeMode,
            startAt: payload.startAt,
            endAt: payload.endAt,
            updatedAt: new Date().toISOString(),
          };
        })
      );
    });

    try {
      const updated = await api.updateImage(payload);
      setItems((currentItems) => {
        const next = sortByDate(
          currentItems.map((item) => (item.id === updated.id ? updated : item))
        );
        saveCacheFeed(next);
        return next;
      });
    } catch (submitError) {
      if (previousItem) {
        setItems((currentItems) => {
          const next = sortByDate(
            currentItems.map((item) => (item.id === payload.id ? previousItem! : item))
          );
          saveCacheFeed(next);
          return next;
        });
      }
      setError(submitError instanceof Error ? submitError.message : '更新失败');
      throw submitError;
    } finally {
      setSubmitting(false);
    }
  };

  const deleteImage = async (id: string) => {
    setSubmitting(true);
    setError(null);

    let removedItem: ImageItem | undefined;
    setItems((currentItems) => {
      removedItem = currentItems.find((item) => item.id === id);
      const next = currentItems.filter((item) => item.id !== id);
      saveCacheFeed(next);
      return next;
    });

    try {
      await api.deleteImage(id);
    } catch (submitError) {
      if (removedItem) {
        setItems((currentItems) => {
          const next = sortByDate([removedItem!, ...currentItems]);
          saveCacheFeed(next);
          return next;
        });
      }
      setError(submitError instanceof Error ? submitError.message : '删除失败');
      throw submitError;
    } finally {
      setSubmitting(false);
    }
  };

  const updateLike = (id: string, likeCount: number, liked: boolean) => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === id ? { ...item, likeCount, liked } : item
      )
    );
  };

  const incrementCommentCount = (id: string, delta: number) => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === id ? { ...item, commentCount: item.commentCount + delta } : item
      )
    );
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
    updateLike,
    incrementCommentCount,
  };
};