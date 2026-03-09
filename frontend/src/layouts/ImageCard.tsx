import { useEffect, useState } from 'react';
import { Heart, MessageCircle, PencilLine, Trash2 } from 'lucide-react';
import { ImageViewer } from '../ui/ImageViewer';
import { PostDialog } from '../ui/PostDialog';
import { CommentDialog } from '../ui/CommentDialog';
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

function ImageGrid({ urls, alt, onImageClick }: { urls: string[]; alt: string; onImageClick: (index: number) => void }) {
  if (urls.length === 0) return null;

  if (urls.length === 1) {
    return (
      <div className="cursor-pointer overflow-hidden bg-slate-950/20" onClick={() => onImageClick(0)}>
        <img alt={alt} className="w-full object-contain" src={urls[0]} />
      </div>
    );
  }

  const cols = urls.length <= 2 ? 2 : 3;
  return (
    <div className={`grid gap-0.5 ${cols === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {urls.map((url, i) => (
        <div className="relative aspect-square cursor-pointer overflow-hidden bg-slate-950/20" key={i} onClick={() => onImageClick(i)}>
          <img alt={`${alt} ${i + 1}`} className="absolute inset-0 h-full w-full object-cover" src={url} />
        </div>
      ))}
    </div>
  );
}

export function ImageCard({ busy, canInteract, editable, fallbackAuthorLogin, item, onAvatarClick, onCommentCountChange, onDelete, onLikeChange, onSave, roleLabel }: ImageCardProps) {
  const [editing, setEditing] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const { confirm } = useToast();

  // Load comments on mount if there are any
  useEffect(() => {
    if (item.commentCount > 0 && comments.length === 0 && !commentsLoading) {
      let cancelled = false;
      setCommentsLoading(true);
      api.getComments(item.authorLogin || fallbackAuthorLogin || '', item.id)
        .then((data) => { if (!cancelled) setComments(data); })
        .catch(() => { if (!cancelled) setComments([]); })
        .finally(() => { if (!cancelled) setCommentsLoading(false); });
      return () => { cancelled = true; };
    }
  }, [item.commentCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const iconButtonClass =
    'inline-flex h-8 w-8 items-center justify-center text-soft transition hover:text-[var(--text-main)]';

  const authorLogin = item.authorLogin || fallbackAuthorLogin || 'GitHub';
  const authorLabel = authorLogin;
  const authorAvatar = item.authorAvatar || (authorLogin !== 'GitHub' ? `https://github.com/${authorLogin}.png?size=64` : '');

  const imageUrls = item.imageUrls ?? [];

  const handleEditSubmit = async (data: { description: string; capturedAt: string; files: File[] }) => {
    await onSave({
      id: item.id,
      description: data.description,
      capturedAt: data.capturedAt,
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
    try {
      const result = await api.toggleLike(authorLogin, item.id);
      onLikeChange?.(item.id, result.likeCount, result.liked);
    } catch {
      // ignore
    } finally {
      setLikeBusy(false);
    }
  };

  const openComments = async () => {
    setCommentsOpen(true);
    setCommentsLoading(true);
    try {
      const data = await api.getComments(authorLogin, item.id);
      setComments(data);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
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
      <article className="group overflow-hidden" id={`story-${item.id}`}>
        {/* Author row + edit/delete */}
        <div className="flex items-center gap-2 px-2 pb-0 pt-3">
          {authorAvatar ? (
            <button
              className="shrink-0 transition-transform hover:scale-110"
              onClick={() => onAvatarClick?.(authorLogin)}
              title={authorLabel}
              type="button"
            >
              <img alt={authorLabel} className="h-8 w-8 rounded-full object-cover ring-1 ring-white/10" src={authorAvatar} />
            </button>
          ) : (
            <button
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-xs font-semibold text-soft ring-1 ring-white/10 transition-transform hover:scale-110"
              onClick={() => onAvatarClick?.(authorLogin)}
              title={authorLabel}
              type="button"
            >
              {authorLabel.slice(0, 1).toUpperCase()}
            </button>
          )}
          <p className="flex flex-1 items-center gap-2 text-sm font-medium text-[var(--text-main)]">
            {authorLabel}
            {roleLabel ? <span className="rounded-full bg-white/8 px-2 py-0.5 text-xs text-soft">{roleLabel}</span> : null}
          </p>
          {editable ? (
            <div className="flex items-center gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
              <button aria-label="修改卡片" className={iconButtonClass} onClick={() => setEditing(true)} type="button">
                <PencilLine size={15} />
              </button>
              <button aria-label="删除卡片" className={`${iconButtonClass} text-rose-300 hover:text-rose-200`} onClick={handleDelete} type="button">
                <Trash2 size={15} />
              </button>
            </div>
          ) : null}
        </div>
        {/* Description */}
        {item.description.trim() ? (
          <p className="whitespace-pre-wrap px-2 pt-2 font-serif text-xl leading-relaxed text-[var(--text-main)] md:text-2xl">
            {item.description}
          </p>
        ) : null}
        {/* Images */}
        {imageUrls.length > 0 ? (
          <div className="mt-2 px-2">
            <ImageGrid alt={item.description} onImageClick={setViewerIndex} urls={imageUrls} />
          </div>
        ) : null}
        {/* Footer: time + like & comment */}
        <div className="flex items-center justify-between gap-4 px-2 pb-1 pt-2">
          <p className="text-xs text-soft">{toBeijingText(item.capturedAt)}</p>
          <div className="flex items-center gap-4">
            <button
              className={`inline-flex items-center gap-1 text-xs transition ${item.liked ? 'text-rose-400' : 'text-soft hover:text-rose-300'}`}
              disabled={!canInteract || likeBusy}
              onClick={() => void handleToggleLike()}
              type="button"
            >
              <Heart className={item.liked ? 'fill-current' : ''} size={16} />
              {item.likeCount > 0 ? <span>{item.likeCount}</span> : null}
            </button>
            <button
              className="inline-flex items-center gap-1 text-xs text-soft transition hover:text-[var(--text-main)]"
              onClick={() => void openComments()}
              type="button"
            >
              <MessageCircle size={16} />
              {item.commentCount > 0 ? <span>{item.commentCount}</span> : null}
            </button>
          </div>
        </div>

        {/* Inline comments preview */}
        {comments.length > 0 && !commentsLoading ? (
          <div className="space-y-1.5 px-2 pb-3">
            {comments.slice(-3).map((c) => (
              <div className="flex items-start gap-1.5" key={c.id}>
                <img
                  alt={c.authorLogin}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded-full object-cover"
                  src={`https://github.com/${c.authorLogin}.png?size=32`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[var(--text-main)]">
                    <span className="font-medium">{c.authorLogin}</span>
                    {c.text ? <span className="ml-1">{c.text}</span> : null}
                  </p>
                  {c.imageUrl ? (
                    <img
                      alt="评论图片"
                      className="mt-0.5 max-h-20 max-w-32 rounded object-cover"
                      src={c.imageUrl}
                    />
                  ) : null}
                </div>
              </div>
            ))}
            {comments.length > 3 ? (
              <button
                className="text-xs text-soft hover:text-[var(--text-main)] transition"
                onClick={() => void openComments()}
                type="button"
              >
                查看全部 {comments.length} 条评论
              </button>
            ) : null}
          </div>
        ) : null}
      </article>

      {/* Image viewer lightbox */}
      {viewerIndex !== null ? (
        <ImageViewer initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} urls={imageUrls} />
      ) : null}

      {/* Edit dialog */}
      <PostDialog
        busy={busy}
        initialCapturedAt={toDateTimeInputValue(item.capturedAt)}
        initialDescription={item.description}
        initialImageUrls={imageUrls}
        mode="edit"
        onClose={() => setEditing(false)}
        onSubmit={handleEditSubmit}
        open={editing}
      />

      {/* Comment dialog */}
      <CommentDialog
        busy={commentBusy}
        canComment={canInteract}
        comments={comments}
        loading={commentsLoading}
        onClose={() => setCommentsOpen(false)}
        onSubmit={handleAddComment}
        open={commentsOpen}
      />
    </>
  );
}