import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { normalizeAssetTypes } from '@/lib/media';
import type {
  CreateImagePayload,
  FeedUser,
  HealthStats,
  ImageItem,
  TimelineMonth,
  UpdateImagePayload,
} from '@/types/image';

const getMonthKey = (startAt: string) => {
  const date = new Date(startAt);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  return {
    key: `${year}-${String(month).padStart(2, '0')}`,
    year,
    month,
  };
};

const normalizeTagKey = (value: string) => value.trim().toLowerCase();

type TimeSortOrder = 'desc' | 'asc';

const defaultStats: HealthStats = {
  userCount: 0,
  onlineUsers: 0,
  uptimeSeconds: 0,
  githubOwner: 'GitHub',
};

const sortByDate = (itemsList: ImageItem[], order: TimeSortOrder) =>
  [...itemsList].sort((left, right) => {
    const delta = new Date(left.startAt).getTime() - new Date(right.startAt).getTime();
    return order === 'asc' ? delta : -delta;
  });

const normalizeCachedItem = (item: ImageItem): ImageItem => {
  const imageUrls = item.imageUrls ?? [];
  return {
    ...item,
    tags: item.tags ?? [],
    imageUrls,
    assetTypes: normalizeAssetTypes(imageUrls, item.assetTypes),
  };
};

export const useImages = () => {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [feedUsers, setFeedUsers] = useState<FeedUser[]>([]);
  const [filterUser, setFilterUser] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [stats, setStats] = useState<HealthStats>(defaultStats);
  const [timeOrder, setTimeOrder] = useState<TimeSortOrder>('desc');
  const lastStatsFetchRef = useRef<number>(0);
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

        const sorted = sortByDate(nextItems.map(normalizeCachedItem), timeOrder);
        setItems(sorted);
        setStats(nextStats);
        setFeedUsers(nextUsers);
        lastStatsFetchRef.current = Date.now();
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void bootstrap();

    const pingTimer = setInterval(() => {
      void api.pingStats().catch(() => undefined);
      if (Date.now() - lastStatsFetchRef.current > 120000) {
        void api.getStats().then((nextStats) => {
          setStats(nextStats);
          lastStatsFetchRef.current = Date.now();
        }).catch(() => undefined);
      }
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(pingTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setItems((currentItems) => sortByDate(currentItems, timeOrder));
  }, [timeOrder]);

  const userScopedItems = useMemo(() => {
    if (!filterUser) return items;
    return items.filter(
      (item) => item.authorLogin.toLowerCase() === filterUser.toLowerCase()
    );
  }, [items, filterUser]);

  const { tagSummary, tagCountMap } = useMemo(() => {
    const counts = new Map<string, { tag: string; count: number }>();
    userScopedItems.forEach((item) => {
      (item.tags ?? []).forEach((tag) => {
        const key = normalizeTagKey(tag);
        if (!key) return;
        const existing = counts.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(key, { tag, count: 1 });
        }
      });
    });
    const summary = [...counts.values()].sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.tag.localeCompare(right.tag, 'en');
    });
    const countMap: Record<string, number> = {};
    summary.forEach((entry) => {
      countMap[normalizeTagKey(entry.tag)] = entry.count;
    });
    return { tagSummary: summary, tagCountMap: countMap };
  }, [userScopedItems]);

  useEffect(() => {
    if (!tagFilter) return;
    const key = normalizeTagKey(tagFilter);
    const exists = tagSummary.some((entry) => normalizeTagKey(entry.tag) === key);
    if (!exists) {
      setTagFilter(null);
    }
  }, [tagFilter, tagSummary]);

  const filteredItems = useMemo(() => {
    if (!tagFilter) return userScopedItems;
    const key = normalizeTagKey(tagFilter);
    return userScopedItems.filter((item) =>
      (item.tags ?? []).some((tag) => normalizeTagKey(tag) === key)
    );
  }, [userScopedItems, tagFilter]);

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
        label: `${month.year}-${String(month.month).padStart(2, '0')}`,
        count: 1,
      });
    });

    return [...monthMap.values()].sort((left, right) =>
      timeOrder === 'asc' ? left.key.localeCompare(right.key) : right.key.localeCompare(left.key)
    );
  }, [filteredItems, timeOrder]);

  const createImage = async (payload: CreateImagePayload) => {
    setSubmitting(true);
    setError(null);

    try {
      const created = await api.createImage(payload);
      setItems((currentItems) => sortByDate([created, ...currentItems], timeOrder));
      api.getFeedUsers().then(setFeedUsers).catch(() => undefined);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Upload failed');
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
        }),
        timeOrder
      );
    });

    try {
      const updated = await api.updateImage(payload);
      setItems((currentItems) =>
        sortByDate(
          currentItems.map((item) => (item.id === updated.id ? updated : item)),
          timeOrder
        )
      );
    } catch (submitError) {
      if (previousItem) {
        setItems((currentItems) =>
          sortByDate(
            currentItems.map((item) => (item.id === payload.id ? previousItem! : item)),
            timeOrder
          )
        );
      }
      setError(submitError instanceof Error ? submitError.message : 'Update failed');
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
      return currentItems.filter((item) => item.id !== id);
    });

    try {
      await api.deleteImage(id);
    } catch (submitError) {
      if (removedItem) {
        setItems((currentItems) => sortByDate([removedItem!, ...currentItems], timeOrder));
      }
      setError(submitError instanceof Error ? submitError.message : 'Delete failed');
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

  const toggleTimeOrder = () => {
    setTimeOrder((current) => (current === 'desc' ? 'asc' : 'desc'));
  };

  const refreshFeedUsers = useCallback(async () => {
    try {
      const users = await api.getFeedUsers();
      setFeedUsers(users);
    } catch {
      // ignore
    }
  }, []);

  return {
    items: filteredItems,
    allItems: items,
    feedUsers,
    filterUser,
    setFilterUser,
    tagFilter,
    setTagFilter,
    tagSummary,
    tagCountMap,
    timeline,
    timeOrder,
    toggleTimeOrder,
    refreshFeedUsers,
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
