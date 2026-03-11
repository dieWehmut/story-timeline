import type { CommentItem } from '../types/image';

type CommentCacheEntry = {
  items: CommentItem[];
  ts: number;
};

const COMMENT_CACHE_TTL = 1000 * 30;
const commentCache = new Map<string, CommentCacheEntry>();

export const getCommentCache = (key: string) => {
  const entry = commentCache.get(key);
  if (!entry) return null;
  const stale = Date.now() - entry.ts > COMMENT_CACHE_TTL;
  return { items: entry.items, stale };
};

export const setCommentCache = (key: string, items: CommentItem[]) => {
  commentCache.set(key, { items, ts: Date.now() });
};

export const invalidateCommentCache = (key: string) => {
  commentCache.delete(key);
};
