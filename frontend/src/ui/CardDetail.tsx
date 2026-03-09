import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { Heart, ImagePlus, LoaderCircle, MessageCircle, PencilLine, Send, Trash2, X } from 'lucide-react';
import { ImageViewer } from './ImageViewer';
import { PostDialog } from './PostDialog';
import { useToast } from './useToast';
import { api } from '../lib/api';
import type { CommentItem, ImageItem, UpdateImagePayload } from '../types/image';

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
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '';
  return `${year}-${month}-${day} ${hour}:${minute}`;
};

const toCommentTime = (value: string) => {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(new Date(value));
};

const toDisplayTime = (item: ImageItem) => {
  const startText = toBeijingText(item.startAt);
  if (item.timeMode !== 'range' || !item.endAt) return startText;
  return `${startText} - ${toBeijingText(item.endAt)}`;
};

function DetailImageGrid({
  urls,
  alt,
  onImageClick,
}: {
  urls: string[];
  alt: string;
  onImageClick: (index: number) => void;
}) {
  if (urls.length === 0) return null;

  if (urls.length === 1) {
    return (
      <div className="flex justify-center px-4">
        <div
          className="w-2/3 cursor-pointer overflow-hidden bg-slate-950/20"
          onClick={() => onImageClick(0)}
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
    <div className={`grid gap-0.5 px-4 ${cols === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {urls.map((url, i) => (
        <div
          className="relative aspect-square cursor-pointer overflow-hidden bg-slate-950/20"
          key={i}
          onClick={() => onImageClick(i)}
        >
          <img alt={`${alt} ${i + 1}`} className="absolute inset-0 h-full w-full object-cover" src={url} />
        </div>
      ))}
    </div>
  );
}

interface CardDetailProps {
  item: ImageItem;
  fallbackAuthorLogin?: string;
  roleLabel?: string;
  canInteract: boolean;
  editable?: boolean;
  onDelete?: (id: string) => Promise<void>;
  onSave?: (payload: UpdateImagePayload) => Promise<void>;
  onLikeChange?: (id: string, likeCount: number, liked: boolean) => void;
  onCommentCountChange?: (id: string, delta: number) => void;
}

export function CardDetail({
  item,
  fallbackAuthorLogin,
  roleLabel,
  canInteract,
  editable,
  onDelete,
  onSave,
  onLikeChange,
  onCommentCountChange,
}: CardDetailProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [viewingCommentImage, setViewingCommentImage] = useState<string | null>(null);
  const [likeBusy, setLikeBusy] = useState(false);

  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const { confirm } = useToast();

  const authorLogin = item.authorLogin || fallbackAuthorLogin || 'GitHub';
  const authorAvatar =
    item.authorAvatar || (authorLogin !== 'GitHub' ? `https://github.com/${authorLogin}.png?size=64` : '');
  const imageUrls = item.imageUrls ?? [];

  // Lock body scroll while detail is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Load all comments on mount
  useEffect(() => {
    let cancelled = false;
    setCommentsLoading(true);
    api
      .getComments(authorLogin, item.id)
      .then((data) => {
        if (!cancelled) setComments(data);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authorLogin, item.id]);

  const handleToggleLike = async () => {
    if (likeBusy || !canInteract) return;
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

  const handleDeleteItem = () => {
    confirm('确定要删除这张卡片吗？', () => {
      void onDelete?.(item.id);
    });
  };

  const handleEditSubmit = async (data: {
    description: string;
    timeMode: 'point' | 'range';
    startAt: string;
    endAt?: string;
    files: File[];
  }) => {
    await onSave?.({
      id: item.id,
      description: data.description,
      timeMode: data.timeMode,
      startAt: data.startAt,
      endAt: data.endAt,
      files: data.files.length > 0 ? data.files : undefined,
    });
    setEditing(false);
  };

  const handleFileSelect = useCallback((incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const selected = incoming[0];
    if (selected.size > 5 * 1024 * 1024) {
      setError('图片不能超过 5MB');
      return;
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setError(null);
  }, []);

  const removeFile = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
  }, [preview]);

  const handleAddComment = async () => {
    if (!text.trim() && !file) return;
    setCommentBusy(true);
    try {
      const newComment = await api.addComment(authorLogin, item.id, text.trim(), file ?? undefined);
      setComments((prev) => [...prev, newComment]);
      onCommentCountChange?.(item.id, 1);
      setText('');
      removeFile();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '评论失败');
    } finally {
      setCommentBusy(false);
    }
  };

  return (
    <>
      {/* Full-screen overlay, renders below the z-40 fixed Header */}
      <div className="fixed inset-0 z-[35] flex flex-col bg-[var(--page-bg)]">
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-xl pb-6 pt-12 md:pt-14">
            {/* Author row + right action column */}
            <div className="group flex px-2 pt-1">
              {/* Left: avatar + name */}
              <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1">
                {authorAvatar ? (
                  <img
                    alt={authorLogin}
                    className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                    src={authorAvatar}
                  />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-xs font-semibold text-soft ring-1 ring-white/10">
                    {authorLogin.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <p className="flex min-w-0 flex-1 items-center gap-2 truncate text-sm font-medium text-[var(--text-main)]">
                  {authorLogin}
                  {roleLabel ? (
                    <span className="rounded-full bg-white/8 px-2 py-0.5 text-xs text-soft">{roleLabel}</span>
                  ) : null}
                </p>
              </div>
              {/* Right: edit/delete (top), like/comment (bottom) — but here only top row */}
              {editable ? (
                <div className="flex w-16 shrink-0 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                  <button
                    aria-label="修改卡片"
                    className="inline-flex h-8 w-8 items-center justify-center text-soft transition hover:text-[var(--text-main)]"
                    onClick={() => setEditing(true)}
                    type="button"
                  >
                    <PencilLine size={14} />
                  </button>
                  <button
                    aria-label="删除卡片"
                    className="inline-flex h-8 w-8 items-center justify-center text-rose-300 transition hover:text-rose-200"
                    onClick={handleDeleteItem}
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : (
                <div className="w-16 shrink-0" />
              )}
            </div>

            {/* Description */}
            {item.description.trim() ? (
              <p className="whitespace-pre-wrap px-4 pt-2 font-serif text-xl leading-relaxed text-[var(--text-main)] md:text-2xl">
                {item.description}
              </p>
            ) : null}

            {/* Images */}
            {imageUrls.length > 0 ? (
              <div className="mt-2">
                <DetailImageGrid alt={item.description} onImageClick={setViewerIndex} urls={imageUrls} />
              </div>
            ) : null}

            {/* Time + like + comment — same 2-column alignment */}
            <div className="flex px-2">
              <div className="min-w-0 flex-1 px-2 pt-3">
                <p className="text-xs text-soft">{toDisplayTime(item)}</p>
              </div>
              <div className="flex w-16 shrink-0">
                <button
                  className={`flex w-8 flex-col items-center gap-0.5 py-1 transition ${item.liked ? 'text-rose-400' : 'text-soft hover:text-rose-300'}`}
                  disabled={!canInteract || likeBusy}
                  onClick={() => void handleToggleLike()}
                  type="button"
                >
                  <Heart className={item.liked ? 'fill-current' : ''} size={14} />
                  {item.likeCount > 0 ? <span className="text-[10px] leading-none">{item.likeCount}</span> : null}
                </button>
                <button
                  className="flex w-8 flex-col items-center gap-0.5 py-1 text-soft transition hover:text-[var(--text-main)]"
                  onClick={() => commentInputRef.current?.focus()}
                  type="button"
                >
                  <MessageCircle size={14} />
                  {item.commentCount > 0 ? <span className="text-[10px] leading-none">{item.commentCount}</span> : null}
                </button>
              </div>
            </div>

            {/* Comments section */}
            <div className="mt-2 border-t border-[var(--panel-border)]">
              {commentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoaderCircle className="animate-spin text-cyan-300" size={20} />
                </div>
              ) : comments.length === 0 ? (
                <p className="py-8 text-center text-sm text-soft">暂无评论</p>
              ) : (
                <div className="divide-y divide-[var(--panel-border)]">
                  {comments.map((c) => (
                    <div className="flex gap-3 px-4 py-3" key={c.id}>
                      {/* Avatar */}
                      <img
                        alt={c.authorLogin}
                        className="mt-0.5 h-8 w-8 shrink-0 rounded-full object-cover"
                        src={`https://github.com/${c.authorLogin}.png?size=48`}
                      />
                      {/* Content: username + time on top, text below */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-sm font-medium text-[var(--text-main)]">{c.authorLogin}</span>
                          <span className="text-xs text-soft">{toCommentTime(c.createdAt)}</span>
                        </div>
                        {c.text ? (
                          <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--text-main)]">{c.text}</p>
                        ) : null}
                        {c.imageUrl ? (
                          <img
                            alt="评论图片"
                            className="mt-1 max-h-40 max-w-56 cursor-pointer rounded object-cover"
                            onClick={() => setViewingCommentImage(c.imageUrl!)}
                            src={c.imageUrl}
                          />
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Comment input bar (sticky at bottom) */}
        {canInteract ? (
          <div className="shrink-0 border-t border-[var(--panel-border)] bg-[var(--page-bg)] px-4 py-2">
            {preview ? (
              <div className="relative mb-2 inline-block">
                <img alt="" className="h-16 w-16 rounded object-cover" src={preview} />
                <button
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white/80 hover:text-white"
                  onClick={removeFile}
                  type="button"
                >
                  <X size={12} />
                </button>
              </div>
            ) : null}
            {error ? <p className="mb-1 text-xs text-rose-300">{error}</p> : null}
            <div className="flex items-center gap-2">
              <button
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-soft transition hover:text-[var(--text-main)]"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <ImagePlus size={18} />
              </button>
              <input
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleFileSelect(e.target.files);
                  e.target.value = '';
                }}
                ref={fileInputRef}
                type="file"
              />
              <input
                className="min-w-0 flex-1 border border-white/10 bg-transparent px-3 py-1.5 text-sm text-[var(--text-main)] outline-none transition placeholder:text-soft/50 focus:border-[var(--text-accent)]"
                disabled={commentBusy}
                id={inputId}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleAddComment();
                  }
                }}
                placeholder="写评论..."
                ref={commentInputRef}
                value={text}
              />
              <button
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-cyan-300 transition hover:text-cyan-200 disabled:opacity-50"
                disabled={commentBusy || (!text.trim() && !file)}
                onClick={() => void handleAddComment()}
                type="button"
              >
                {commentBusy ? <LoaderCircle className="animate-spin" size={18} /> : <Send size={18} />}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Edit dialog */}
      {editable ? (
        <PostDialog
          busy={false}
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
      ) : null}

      {/* Image viewer lightbox */}
      {viewerIndex !== null ? (
        <ImageViewer initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} urls={imageUrls} />
      ) : null}

      {/* Comment image viewer */}
      {viewingCommentImage ? (
        <ImageViewer onClose={() => setViewingCommentImage(null)} urls={[viewingCommentImage]} />
      ) : null}
    </>
  );
}
