import { useEffect, useState } from 'react';
import { Heart, LoaderCircle, MessageCircle, PencilLine, Trash2 } from 'lucide-react';
import { CommentDialog } from '../ui/CommentDialog';
import { ImageViewer } from '../ui/ImageViewer';
import { useToast } from '../ui/useToast';
import { api } from '../lib/api';
import { getCommentCache, setCommentCache } from '../lib/commentCache';
import { useLocation, useNavigate } from 'react-router-dom';
import type { CommentItem, ImageItem } from '../types/image';

interface ImageCardProps {
  item: ImageItem;
  fallbackAuthorLogin?: string;
  roleLabel?: string;
  editable: boolean;
  canInteract: boolean;
  onAvatarClick?: (login: string) => void;
  onTagClick?: (tag: string) => void;
  onDelete: (id: string) => Promise<void>;
  onLikeChange?: (id: string, likeCount: number, liked: boolean) => void;
  onCommentCountChange?: (id: string, delta: number) => void;
  onOpenDetail?: () => void;
  tagCounts?: Record<string, number>;
}

const dateOnlyFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timeOnlyFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const toDateKey = (value: Date) => {
  const parts = dateOnlyFormatter.formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  return `${year}-${month}-${day}`;
};

const normalizeLogin = (value: string) => value.trim().toLowerCase();

const getReplyTargetLabel = (comment: CommentItem) => {
  if (!comment.replyToUserLogin) return null;
  const target = comment.replyToUserLogin;
  if (normalizeLogin(target) === normalizeLogin(comment.authorLogin)) {
    return '自己';
  }
  return target;
};

const toDisplayDateTime = (value: string) => {
  const date = new Date(value);
  const dateKey = toDateKey(date);
  const todayKey = toDateKey(new Date());
  const yesterdayKey = toDateKey(new Date(Date.now() - 86400000));
  const beforeYesterdayKey = toDateKey(new Date(Date.now() - 2 * 86400000));
  const timeText = timeOnlyFormatter.format(date);
  let label = dateKey;

  if (dateKey === todayKey) {
    label = '今天';
  } else if (dateKey === yesterdayKey) {
    label = '昨天';
  } else if (dateKey === beforeYesterdayKey) {
    label = '前天';
  }

  return `${label} ${timeText}`;
};

const toDisplayTime = (item: ImageItem) => {
  const startText = toDisplayDateTime(item.startAt);
  if (item.timeMode !== 'range' || !item.endAt) {
    return startText;
  }

  return `${startText} - ${toDisplayDateTime(item.endAt)}`;
};

type CommentViewItem = CommentItem & { pending?: boolean };

function ImageGrid({ urls, alt, onImageClick }: { urls: string[]; alt: string; onImageClick: (index: number) => void }) {
  if (urls.length === 0) return null;

  if (urls.length === 1) {
    return (
      <div className="w-full">
        <div
          className="relative aspect-square w-full cursor-pointer overflow-hidden bg-slate-950/20"
          onClick={(e) => { e.stopPropagation(); onImageClick(0); }}
        >
          <img alt={alt} className="absolute inset-0 h-full w-full object-cover" src={urls[0]} />
        </div>
      </div>
    );
  }

  const cols = urls.length <= 2 ? 2 : 3;
  return (
    <div className={`grid gap-0.5 ${cols === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {urls.map((url, i) => (
        <div
          className="relative aspect-square cursor-pointer overflow-hidden bg-slate-950/20"
          key={i}
          onClick={(e) => { e.stopPropagation(); onImageClick(i); }}
        >
          <img alt={`${alt} ${i + 1}`} className="absolute inset-0 h-full w-full object-cover" src={url} />
        </div>
      ))}
    </div>
  );
}

export function ImageCard({
  canInteract,
  editable,
  fallbackAuthorLogin,
  item,
  onAvatarClick,
  onTagClick,
  onCommentCountChange,
  onDelete,
  onLikeChange,
  onOpenDetail,
  roleLabel,
  tagCounts,
}: ImageCardProps) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [comments, setComments] = useState<CommentViewItem[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [commentImageViewer, setCommentImageViewer] = useState<{ urls: string[]; initialIndex: number } | null>(null);
  const { confirm } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-load comments on mount if there are any (for inline preview)
  useEffect(() => {
    if (item.commentCount > 0) loadCommentsIfNeeded();
  }, [item.commentCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const actionColumnClass =
    'grid w-20 shrink-0 grid-cols-2 items-center justify-items-start pr-0';
  const actionButtonBaseClass =
    'inline-flex h-8 w-12 items-center justify-start gap-1 pl-2 transition';

  const authorLogin = item.authorLogin || fallbackAuthorLogin || 'GitHub';
  const authorAvatar =
    item.authorAvatar || (authorLogin !== 'GitHub' ? `https://github.com/${authorLogin}.png?size=64` : '');
  const imageUrls = item.imageUrls ?? [];
  const tags = item.tags ?? [];
  const commentCacheKey = `${authorLogin}/${item.id}`;

  const handleDelete = () => {
    confirm('确定要删除这张卡片吗？', () => {
      void onDelete(item.id);
    });
  };

  const handleToggleLike = async () => {
    if (likeBusy) return;
    setLikeBusy(true);
    const optimisticLiked = !item.liked;
    const optimisticCount = item.likeCount + (optimisticLiked ? 1 : -1);
    onLikeChange?.(item.id, optimisticCount, optimisticLiked);
    try {
      const result = await api.toggleLike(authorLogin, item.id);
      onLikeChange?.(item.id, result.likeCount, result.liked);
    } catch {
      onLikeChange?.(item.id, item.likeCount, item.liked);
    } finally {
      setLikeBusy(false);
    }
  };

  const loadCommentsIfNeeded = () => {
    if (commentsLoading) return;
    const cached = getCommentCache(commentCacheKey);
    if (cached) {
      setComments(cached.items);
      if (!cached.stale) {
        return;
      }
    }
    if (comments.length === 0 || cached?.stale) {
      setCommentsLoading(true);
      api
        .getComments(authorLogin, item.id)
        .then((data) => {
          setComments(data);
          setCommentCache(commentCacheKey, data);
        })
        .catch(() => { setComments([]); })
        .finally(() => { setCommentsLoading(false); });
    }
  };

  const handleOpenComment = () => {
    loadCommentsIfNeeded();
    setCommentDialogOpen(true);
  };

  const handleAddComment = async (text: string, files?: File[]) => {
    setCommentBusy(true);
    const optimisticComment: CommentViewItem = {
      id: `temp-${Date.now()}`,
      authorLogin: '',
      postOwner: authorLogin,
      postId: item.id,
      text,
      imageUrls: files ? files.map((f) => URL.createObjectURL(f)) : undefined,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      liked: false,
      pending: true,
    };
    setComments((prev) => {
      const next = [...prev, optimisticComment];
      setCommentCache(commentCacheKey, next);
      return next;
    });
    onCommentCountChange?.(item.id, 1);
    try {
      const newComment = await api.addComment(authorLogin, item.id, text, files);
      setComments((prev) => {
        const next = prev.map((c) => (c.id === optimisticComment.id ? newComment : c));
        setCommentCache(commentCacheKey, next);
        return next;
      });
    } catch {
      setComments((prev) => {
        const next = prev.filter((c) => c.id !== optimisticComment.id);
        setCommentCache(commentCacheKey, next);
        return next;
      });
      onCommentCountChange?.(item.id, -1);
    } finally {
      setCommentBusy(false);
    }
  };

  return (
    <>
      <article className="group" id={`story-${item.id}`}>
        {/* Row 1: Author + Description (left) + Edit/Delete (right) */}
        <div className="flex pt-3">
          <div
            className="min-w-0 flex-1 cursor-pointer px-2"
            onClick={() => onOpenDetail?.()}
          >
            {/* Author row */}
            <div className="flex items-center gap-2 pb-1">
              {authorAvatar ? (
                <button
                  className="shrink-0 transition-transform hover:scale-110"
                  onClick={(e) => { e.stopPropagation(); onAvatarClick?.(authorLogin); }}
                  title={authorLogin}
                  type="button"
                >
                  <img
                    alt={authorLogin}
                    className="h-7 w-7 rounded-full object-cover ring-1 ring-white/10"
                    src={authorAvatar}
                  />
                </button>
              ) : (
                <button
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/8 text-xs font-semibold text-soft ring-1 ring-white/10 transition-transform hover:scale-110"
                  onClick={(e) => { e.stopPropagation(); onAvatarClick?.(authorLogin); }}
                  title={authorLogin}
                  type="button"
                >
                  {authorLogin.slice(0, 1).toUpperCase()}
                </button>
              )}
              <p className="flex min-w-0 flex-1 items-center gap-2 truncate text-sm font-medium text-[var(--text-main)]">
                {authorLogin}
                {roleLabel ? (
                  <span className="rounded-full bg-white/8 px-2 py-0.5 text-xs text-soft">{roleLabel}</span>
                ) : null}
              </p>
            </div>

            {/* Description */}
            {item.description.trim() ? (
              <p className="whitespace-pre-wrap pt-1 font-serif text-xl leading-relaxed text-[var(--text-main)] md:text-2xl">
                {item.description}
              </p>
            ) : null}

          </div>

          {/* Right: Edit + Delete */}
          <div className={`${actionColumnClass} ${editable ? 'opacity-100 transition md:opacity-0 md:group-hover:opacity-100' : ''}`}>
            {editable ? (
              <>
                <button
                  aria-label="编辑卡片"
                  className={`${actionButtonBaseClass} text-soft hover:text-[var(--text-main)]`}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/post?id=${item.id}`, { state: { from: `${location.pathname}${location.search}` } });
                  }}
                  type="button"
                >
                  <PencilLine size={14} />
                </button>
                <button
                  aria-label="删除卡片"
                  className={`${actionButtonBaseClass} text-rose-300 hover:text-rose-200`}
                  onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </>
            ) : (
              <>
                <div className="h-8 w-12" />
                <div className="h-8 w-12" />
              </>
            )}
          </div>
        </div>

        {/* Full-width images */}
        {imageUrls.length > 0 ? (
          <div className="mt-2 cursor-pointer" onClick={() => onOpenDetail?.()}>
            <ImageGrid alt={item.description} onImageClick={setViewerIndex} urls={imageUrls} />
          </div>
        ) : null}

        {/* Row 2: Time + Comments (left, clicking opens detail) + Like/Comment (right) */}
        <div className="flex pb-3">
          <div
            className="min-w-0 flex-1 cursor-pointer px-2"
            onClick={() => onOpenDetail?.()}
          >
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-2">
                {tags.map((tag) => {
                  const count = tagCounts?.[tag.trim().toLowerCase()] ?? 0;
                  return (
                    <button
                      className="tag-chip rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-200 transition hover:text-[var(--text-main)]"
                      key={tag}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTagClick?.(tag);
                      }}
                      type="button"
                    >
                      #{tag} ({count})
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* Time */}
            <p className={`${tags.length > 0 ? 'mt-2' : 'pt-2'} text-xs text-soft`}>{toDisplayTime(item)}</p>

            {/* Inline comments preview */}
            {comments.length > 0 && !commentsLoading ? (
              <div className="space-y-1 pb-1 pt-2">
                {comments.map((c) => {
                  const replyTarget = getReplyTargetLabel(c);
                  return (
                    <div className="text-xs" key={c.id}>
                      <span className="font-medium text-[var(--text-main)]">{c.authorLogin}</span>
                      {replyTarget ? (
                        <span className="text-[var(--text-main)]"> 回复 {replyTarget}：</span>
                      ) : (
                        <span className="text-[var(--text-main)]">：</span>
                      )}
                      {c.text ? <span className="text-[var(--text-main)]">{c.text}</span> : null}
                      <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-soft">
                        <Heart className={c.liked ? 'fill-current text-rose-300' : ''} size={10} />
                        {c.likeCount && c.likeCount > 0 ? c.likeCount : null}
                      </span>
                      {c.pending ? <LoaderCircle className="ml-1 inline-block animate-spin text-soft" size={12} /> : null}
                      {c.imageUrls && c.imageUrls.length > 0 ? (
                        <div className="mt-1 grid max-w-40 grid-cols-3 gap-1">
                          {c.imageUrls.map((url, index) => (
                            <img
                              alt="评论图片"
                              className="block h-12 w-12 cursor-pointer rounded object-cover"
                              key={`${c.id}-${url}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setCommentImageViewer({ urls: c.imageUrls!, initialIndex: index });
                              }}
                              src={url}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* Right: Like + Comment */}
          <div className={`${actionColumnClass} items-end pb-1`}>
            <button
              className={`${actionButtonBaseClass} ${item.liked ? 'text-rose-400' : 'text-soft hover:text-rose-300'}`}
              disabled={!canInteract || likeBusy}
              onClick={(e) => { e.stopPropagation(); void handleToggleLike(); }}
              type="button"
            >
              <Heart className={item.liked ? 'fill-current' : ''} size={14} />
              {item.likeCount > 0 ? <span className="text-[10px] leading-none">{item.likeCount}</span> : null}
            </button>
            <button
              className={`${actionButtonBaseClass} text-soft hover:text-[var(--text-main)]`}
              onClick={(e) => { e.stopPropagation(); handleOpenComment(); }}
              type="button"
            >
              <MessageCircle size={14} />
              {item.commentCount > 0 ? <span className="text-[10px] leading-none">{item.commentCount}</span> : null}
            </button>
          </div>
        </div>
      </article>

      {/* Image viewer lightbox */}
      {viewerIndex !== null ? (
        <ImageViewer initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} urls={imageUrls} />
      ) : null}

      {/* Comment bottom sheet */}
      <CommentDialog
        busy={commentBusy}
        canComment={canInteract}
        draftKey={item.id}
        onClose={() => setCommentDialogOpen(false)}
        onSubmit={handleAddComment}
        open={commentDialogOpen}
      />

      {/* Comment image viewer */}
      {commentImageViewer ? (
        <ImageViewer
          initialIndex={commentImageViewer.initialIndex}
          onClose={() => setCommentImageViewer(null)}
          urls={commentImageViewer.urls}
        />
      ) : null}
    </>
  );
}
