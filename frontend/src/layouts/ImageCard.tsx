import { useEffect, useState } from 'react';
import { Heart, MessageCircle, PencilLine, Trash2 } from 'lucide-react';
import { CommentDialog } from '../ui/CommentDialog';
import { ImageViewer } from '../ui/ImageViewer';
import { PostDialog } from '../ui/PostDialog';
import { useToast } from '../ui/useToast';
import { api } from '../lib/api';
import type { CommentItem, ImageItem, UpdateImagePayload } from '../types/image';

interface ImageCardProps {
  item: ImageItem;
  fallbackAuthorLogin?: string;
  roleLabel?: string;
  editable: boolean;
  busy: boolean;
  canInteract: boolean;
  onAvatarClick?: (login: string) => void;
  onDelete: (id: string) => Promise<void>;
  onSave: (payload: UpdateImagePayload) => Promise<void>;
  onLikeChange?: (id: string, likeCount: number, liked: boolean) => void;
  onCommentCountChange?: (id: string, delta: number) => void;
  onOpenDetail?: () => void;
}

const toDateTimeInputValue = (value: string) => {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return formatter.format(new Date(value)).replace(' ', 'T');
};

const toBeijingText = (value: string) => {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date(value));
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '';

  return `${year}-${month}-${day} ${hour}:${minute}`;
};

const toDisplayTime = (item: ImageItem) => {
  const startText = toBeijingText(item.startAt);
  if (item.timeMode !== 'range' || !item.endAt) {
    return startText;
  }

  return `${startText} - ${toBeijingText(item.endAt)}`;
};

function ImageGrid({ urls, alt, onImageClick }: { urls: string[]; alt: string; onImageClick: (index: number) => void }) {
  if (urls.length === 0) return null;

  if (urls.length === 1) {
    return (
      <div className="flex justify-center">
        <div
          className="w-2/3 cursor-pointer overflow-hidden bg-slate-950/20"
          onClick={(e) => { e.stopPropagation(); onImageClick(0); }}
        >
          <div className="relative aspect-square">
            <img alt={alt} className="absolute inset-0 h-full w-full object-cover" src={urls[0]} />
          </div>
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
  busy,
  canInteract,
  editable,
  fallbackAuthorLogin,
  item,
  onAvatarClick,
  onCommentCountChange,
  onDelete,
  onLikeChange,
  onOpenDetail,
  onSave,
  roleLabel,
}: ImageCardProps) {
  const [editing, setEditing] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [commentImageUrl, setCommentImageUrl] = useState<string | null>(null);
  const { confirm } = useToast();

  // Auto-load comments on mount if there are any (for inline preview)
  useEffect(() => {
    if (item.commentCount > 0) loadCommentsIfNeeded();
  }, [item.commentCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const iconButtonClass =
    'inline-flex h-8 w-8 items-center justify-center text-soft transition hover:text-[var(--text-main)]';

  const authorLogin = item.authorLogin || fallbackAuthorLogin || 'GitHub';
  const authorAvatar =
    item.authorAvatar || (authorLogin !== 'GitHub' ? `https://github.com/${authorLogin}.png?size=64` : '');
  const imageUrls = item.imageUrls ?? [];

  const handleEditSubmit = async (data: {
    description: string;
    timeMode: 'point' | 'range';
    startAt: string;
    endAt?: string;
    files: File[];
  }) => {
    await onSave({
      id: item.id,
      description: data.description,
      timeMode: data.timeMode,
      startAt: data.startAt,
      endAt: data.endAt,
      files: data.files.length > 0 ? data.files : undefined,
    });
    setEditing(false);
  };

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
    if (comments.length === 0 && !commentsLoading) {
      setCommentsLoading(true);
      api
        .getComments(authorLogin, item.id)
        .then((data) => { setComments(data); })
        .catch(() => { setComments([]); })
        .finally(() => { setCommentsLoading(false); });
    }
  };

  const handleOpenComment = () => {
    loadCommentsIfNeeded();
    setCommentDialogOpen(true);
  };

  const handleAddComment = async (text: string, file?: File) => {
    setCommentBusy(true);
    try {
      const newComment = await api.addComment(authorLogin, item.id, text, file);
      setComments((prev) => [...prev, newComment]);
      onCommentCountChange?.(item.id, 1);
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
          <div className="flex w-16 shrink-0 pr-2">
            {editable ? (
              <div className="flex opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                <button
                  aria-label="修改卡片"
                  className={iconButtonClass}
                  onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                  type="button"
                >
                  <PencilLine size={14} />
                </button>
                <button
                  aria-label="删除卡片"
                  className={`${iconButtonClass} text-rose-300 hover:text-rose-200`}
                  onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <div className="h-8" />
            )}
          </div>
        </div>

        {/* Full-width images — not constrained by right action column */}
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
            {/* Time */}
            <p className="pt-2 text-xs text-soft">{toDisplayTime(item)}</p>

            {/* Inline comments preview — clicking propagates to open detail */}
            {comments.length > 0 && !commentsLoading ? (
              <div className="space-y-1 pb-1 pt-2">
                {comments.slice(0, 5).map((c) => (
                  <div className="text-xs" key={c.id}>
                    <span className="font-medium text-[var(--text-main)]">{c.authorLogin}</span>
                    <span className="text-[var(--text-main)]">：</span>
                    {c.text ? <span className="text-[var(--text-main)]">{c.text}</span> : null}
                    {c.imageUrl ? (
                      <img
                        alt="评论图片"
                        className="mt-0.5 block max-h-16 max-w-28 cursor-pointer rounded object-cover"
                        onClick={(e) => { e.stopPropagation(); setCommentImageUrl(c.imageUrl!); }}
                        src={c.imageUrl}
                      />
                    ) : null}
                  </div>
                ))}
                {comments.length > 5 ? (
                  <span className="text-base leading-none text-soft">···</span>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Right: Like + Comment */}
          <div className="flex w-16 shrink-0 items-end pb-1 pr-2">
            <button
              className={`flex w-8 flex-col items-center gap-0.5 py-1 transition ${item.liked ? 'text-rose-400' : 'text-soft hover:text-rose-300'}`}
              disabled={!canInteract || likeBusy}
              onClick={(e) => { e.stopPropagation(); void handleToggleLike(); }}
              type="button"
            >
              <Heart className={item.liked ? 'fill-current' : ''} size={14} />
              {item.likeCount > 0 ? <span className="text-[10px] leading-none">{item.likeCount}</span> : null}
            </button>
            <button
              className="flex w-8 flex-col items-center gap-0.5 py-1 text-soft transition hover:text-[var(--text-main)]"
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

      {/* Edit dialog */}
      <PostDialog
        busy={busy}
        initialDescription={item.description}
        initialImageUrls={imageUrls}
        initialStartAt={toDateTimeInputValue(item.startAt)}
        initialEndAt={item.endAt ? toDateTimeInputValue(item.endAt) : undefined}
        initialTimeMode={item.timeMode}
        mode="edit"
        onClose={() => setEditing(false)}
        onSubmit={handleEditSubmit}
        open={editing}
      />

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
      {commentImageUrl ? (
        <ImageViewer onClose={() => setCommentImageUrl(null)} urls={[commentImageUrl]} />
      ) : null}
    </>
  );
}