import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { Heart, ImagePlus, LoaderCircle, MessageCircle, PencilLine, Send, Trash2, X } from 'lucide-react';
import { ImageViewer } from './ImageViewer';
import { PostDialog } from './PostDialog';
import { useToast } from './useToast';
import { api } from '../lib/api';
import type { CommentItem, ImageItem, UpdateImagePayload } from '../types/image';

// Module-level cache: persists draft comment files while detail view is closed
const detailFileCache = new Map<string, File[]>();
const MAX_COMMENT_FILES = 3;
const MAX_COMMENT_FILE_SIZE = 5 * 1024 * 1024;
const MAX_COMMENT_TOTAL_SIZE = 25 * 1024 * 1024;

const createPreviewUrls = (files: File[]) => files.map((currentFile) => URL.createObjectURL(currentFile));
const revokePreviewUrls = (urls: string[]) => {
  urls.forEach((url) => URL.revokeObjectURL(url));
};

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

type CommentViewItem = CommentItem & { pending?: boolean };

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
  currentUserLogin?: string;
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
  currentUserLogin,
  onDelete,
  onSave,
  onLikeChange,
  onCommentCountChange,
}: CardDetailProps) {
  const [comments, setComments] = useState<CommentViewItem[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [viewingCommentImage, setViewingCommentImage] = useState<{ urls: string[]; initialIndex: number } | null>(null);
  const [likeBusy, setLikeBusy] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const { confirm } = useToast();
  const fileRef = useRef<File[]>([]);
  const previewRef = useRef<string[]>([]);

  const replaceCommentFiles = useCallback((nextFiles: File[]) => {
    revokePreviewUrls(previewRef.current);
    const nextPreviews = createPreviewUrls(nextFiles);
    setFiles(nextFiles);
    setPreviews(nextPreviews);
  }, []);

  useEffect(() => { fileRef.current = files; }, [files]);
  useEffect(() => { previewRef.current = previews; }, [previews]);

  // Restore draft file on mount; save draft file on unmount
  useEffect(() => {
    const cached = detailFileCache.get(item.id);
    if (cached && cached.length > 0) {
      replaceCommentFiles(cached);
      detailFileCache.delete(item.id);
    }
    return () => {
      if (fileRef.current.length > 0) {
        detailFileCache.set(item.id, fileRef.current);
      } else {
        detailFileCache.delete(item.id);
      }
      revokePreviewUrls(previewRef.current);
    };
  }, [item.id, replaceCommentFiles]);

  const authorLogin = item.authorLogin || fallbackAuthorLogin || 'GitHub';
  const authorAvatar =
    item.authorAvatar || (authorLogin !== 'GitHub' ? `https://github.com/${authorLogin}.png?size=64` : '');
  const imageUrls = item.imageUrls ?? [];
  const tags = item.tags ?? [];

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
    tags: string[];
    timeMode: 'point' | 'range';
    startAt: string;
    endAt?: string;
    files: File[];
  }) => {
    await onSave?.({
      id: item.id,
      description: data.description,
      tags: data.tags,
      timeMode: data.timeMode,
      startAt: data.startAt,
      endAt: data.endAt,
      files: data.files.length > 0 ? data.files : undefined,
    });
    setEditing(false);
  };

  const handleFileSelect = useCallback((incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const selectedFiles = Array.from(incoming);
    const nextFiles = [...fileRef.current, ...selectedFiles];

    if (nextFiles.length > MAX_COMMENT_FILES) {
      setError(`评论最多上传 ${MAX_COMMENT_FILES} 张图片`);
      return;
    }

    let totalSize = 0;
    for (const selected of nextFiles) {
      if (selected.size > MAX_COMMENT_FILE_SIZE) {
        setError(`单张图片不能超过 5MB: ${selected.name}`);
        return;
      }
      totalSize += selected.size;
    }
    if (totalSize > MAX_COMMENT_TOTAL_SIZE) {
      setError('评论图片总大小不能超过 25MB');
      return;
    }

    replaceCommentFiles(nextFiles);
    setError(null);
  }, [replaceCommentFiles]);

  const removeFile = useCallback((index: number) => {
    replaceCommentFiles(fileRef.current.filter((_, currentIndex) => currentIndex !== index));
  }, [replaceCommentFiles]);

  const handleAddComment = async () => {
    if (!text.trim() && files.length === 0) return;
    setCommentBusy(true);

    const optimisticComment: CommentViewItem = {
      id: `temp-${Date.now()}`,
      authorLogin: '',
      postOwner: authorLogin,
      postId: item.id,
      text: text.trim(),
      imageUrls: files.map((f) => URL.createObjectURL(f)),
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setComments((prev) => [...prev, optimisticComment]);
    onCommentCountChange?.(item.id, 1);
    const submittedText = text.trim();
    const submittedFiles = files.length > 0 ? [...files] : undefined;
    setText('');
    replaceCommentFiles([]);
    detailFileCache.delete(item.id);
    setError(null);

    try {
      const newComment = await api.addComment(authorLogin, item.id, submittedText, submittedFiles);
      setComments((prev) => prev.map((c) => (c.id === optimisticComment.id ? newComment : c)));
    } catch (e) {
      setComments((prev) => prev.filter((c) => c.id !== optimisticComment.id));
      onCommentCountChange?.(item.id, -1);
      setError(e instanceof Error ? e.message : '评论失败');
    } finally {
      setCommentBusy(false);
    }
  };

  const handleDeleteComment = async (comment: CommentItem) => {
    if (deletingCommentId) return;
    setDeletingCommentId(comment.id);
    // Optimistically remove
    setComments((prev) => prev.filter((c) => c.id !== comment.id));
    onCommentCountChange?.(item.id, -1);
    try {
      const commenter = comment.authorLogin !== currentUserLogin ? comment.authorLogin : undefined;
      await api.deleteComment(authorLogin, item.id, comment.id, commenter);
    } catch {
      // Revert
      setComments((prev) => {
        const restored = [...prev, comment].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        return restored;
      });
      onCommentCountChange?.(item.id, 1);
    } finally {
      setDeletingCommentId(null);
    }
  };

  const isCardOwner = currentUserLogin ? authorLogin.toLowerCase() === currentUserLogin.toLowerCase() : false;

  return (
    <>
      {/* Full-screen overlay, renders below the z-40 fixed Header */}
      <div className="fixed inset-0 z-[35] flex flex-col bg-[var(--page-bg)]">
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-xl pb-6 pt-11 md:pt-12">
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

            {tags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2 px-4">
                {tags.map((tag) => (
                  <span className="tag-chip rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-200" key={tag}>
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}

            {/* Time + like + comment — same 2-column alignment */}
            <div className="flex px-2">
              <div className="min-w-0 flex-1 px-2 pt-3">
                <p className="text-xs text-soft">{toDisplayTime(item)}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  className={`flex items-center gap-1 py-1 transition ${item.liked ? 'text-rose-400' : 'text-soft hover:text-rose-300'}`}
                  disabled={!canInteract || likeBusy}
                  onClick={() => void handleToggleLike()}
                  type="button"
                >
                  <Heart className={item.liked ? 'fill-current' : ''} size={14} />
                  {item.likeCount > 0 ? <span className="text-[10px] leading-none">{item.likeCount}</span> : null}
                </button>
                <button
                  className="flex items-center gap-1 py-1 text-soft transition hover:text-[var(--text-main)]"
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
                  {comments.map((c) => {
                    const canDelete = currentUserLogin && (
                      c.authorLogin.toLowerCase() === currentUserLogin.toLowerCase() || isCardOwner
                    );
                    return (
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
                          {c.pending ? <LoaderCircle className="animate-spin text-soft" size={12} /> : null}
                        </div>
                        {c.text ? (
                          <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--text-main)]">{c.text}</p>
                        ) : null}
                        {c.imageUrls && c.imageUrls.length > 0 ? (
                          <div className="mt-2 grid max-w-56 grid-cols-3 gap-1">
                            {c.imageUrls.map((url, index) => (
                              <img
                                alt="评论图片"
                                className="h-20 w-full cursor-pointer rounded object-cover"
                                key={`${c.id}-${url}`}
                                onClick={() => setViewingCommentImage({ urls: c.imageUrls!, initialIndex: index })}
                                src={url}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {canDelete ? (
                        <button
                          aria-label="删除评论"
                          className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center text-soft transition hover:text-rose-300"
                          disabled={deletingCommentId === c.id}
                          onClick={() => {
                            confirm('确定要删除这条评论吗？', () => { void handleDeleteComment(c); });
                          }}
                          type="button"
                        >
                          {deletingCommentId === c.id ? <LoaderCircle className="animate-spin" size={13} /> : <Trash2 size={13} />}
                        </button>
                      ) : null}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Comment input bar (sticky at bottom) */}
        {canInteract ? (
          <div className="shrink-0 border-t border-[var(--panel-border)] bg-[var(--page-bg)] px-4 py-2">
            {previews.length > 0 ? (
              <div className="mb-2 grid grid-cols-3 gap-2">
                {previews.map((preview, index) => (
                  <div className="relative inline-block" key={`${preview}-${index}`}>
                    <img alt="" className="h-16 w-full rounded object-cover" src={preview} />
                    <button
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white/80 hover:text-white"
                      onClick={() => removeFile(index)}
                      type="button"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
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
                multiple
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
                className="send-icon inline-flex h-9 w-9 shrink-0 items-center justify-center text-cyan-300 transition hover:text-cyan-200 disabled:opacity-50"
                disabled={commentBusy || (!text.trim() && files.length === 0)}
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
          initialTags={tags}
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
        <ImageViewer
          initialIndex={viewingCommentImage.initialIndex}
          onClose={() => setViewingCommentImage(null)}
          urls={viewingCommentImage.urls}
        />
      ) : null}
    </>
  );
}
