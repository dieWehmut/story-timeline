import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { FeedUser } from '../types/image';
import { useAuth } from './useAuth';

interface UseFollowsOptions {
  onChange?: () => void;
}

const normalizeLogin = (value: string) => value.trim().toLowerCase();

export const useFollows = (auth: ReturnType<typeof useAuth>, options?: UseFollowsOptions) => {
  const [following, setFollowing] = useState<FeedUser[]>([]);
  const [followers, setFollowers] = useState<FeedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const followingSet = useMemo(() => new Set(following.map((user) => normalizeLogin(user.login))), [following]);

  const isFollowing = useCallback(
    (login: string) => followingSet.has(normalizeLogin(login)),
    [followingSet]
  );

  const refresh = useCallback(async () => {
    if (!auth.authenticated || !auth.user) {
      setFollowing([]);
      setFollowers([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [nextFollowing, nextFollowers] = await Promise.all([
        api.getFollowing(),
        api.getFollowers(),
      ]);
      setFollowing(nextFollowing);
      setFollowers(nextFollowers);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [auth.authenticated, auth.user]);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.authenticated) {
      setFollowing([]);
      setFollowers([]);
      return;
    }
    void refresh();
  }, [auth.authenticated, auth.loading, auth.user?.login, refresh]);

  const follow = useCallback(
    async (login: string, avatarUrl?: string) => {
      if (!auth.authenticated) return;
      if (isFollowing(login)) return;
      try {
        await api.followUser(login);
        setFollowing((prev) => {
          if (prev.some((user) => normalizeLogin(user.login) === normalizeLogin(login))) {
            return prev;
          }
          const resolvedAvatar = avatarUrl || `https://github.com/${login}.png?size=64`;
          return [...prev, { login, avatarUrl: resolvedAvatar }];
        });
        options?.onChange?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : '关注失败');
      }
    },
    [auth.authenticated, isFollowing, options]
  );

  const unfollow = useCallback(
    async (login: string) => {
      if (!auth.authenticated) return;
      try {
        await api.unfollowUser(login);
        setFollowing((prev) => prev.filter((user) => normalizeLogin(user.login) !== normalizeLogin(login)));
        options?.onChange?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : '取关失败');
      }
    },
    [auth.authenticated, options]
  );

  return {
    following,
    followers,
    loading,
    error,
    isFollowing,
    follow,
    unfollow,
    refresh,
  };
};
