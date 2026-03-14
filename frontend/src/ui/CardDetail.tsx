import { useState, useEffect, useRef, useCallback, useId, useMemo } from 'react';

import { CornerUpLeft, Heart, ImagePlus, LoaderCircle, MessageCircle, PencilLine, Play, Send, Trash2, X } from 'lucide-react';

import { ImageViewer } from './ImageViewer';

import { FollowButton } from './FollowButton';

import { useToast } from '../utils/useToast';

import { api } from '../lib/api';

import { getCommentCache, setCommentCache } from '../lib/commentCache';

import { setCommentInputActive } from '../lib/uiFlags';

import { buildMediaItems, mediaTypeFromFile } from '../lib/media';

import { useLocation, useNavigate } from 'react-router-dom';

import type { CommentItem, ImageItem } from '../types/image';
import { useProfile } from '../context/ProfileContext';



// Module-level cache: persists draft comment files while detail view is closed

const detailFileCache = new Map<string, File[]>();

const MAX_COMMENT_FILES = 3;

const MAX_COMMENT_FILE_SIZE = 5 * 1024 * 1024;

const MAX_COMMENT_TOTAL_SIZE = 25 * 1024 * 1024;

const MAX_COMMENT_VIDEOS = 3;

const MAX_COMMENT_VIDEO_SIZE = 200 * 1024 * 1024;



type PreviewItem = { url: string; type: 'image' | 'video' };



const createPreviewItems = (files: File[]): PreviewItem[] =>

  files.map((currentFile) => ({

    url: URL.createObjectURL(currentFile),

    type: mediaTypeFromFile(currentFile),

  }));



const revokePreviewUrls = (items: PreviewItem[]) => {

  items.forEach((item) => URL.revokeObjectURL(item.url));

};



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

  const year = parts.find((p) => p.type === 'year')?.value ?? '';

  const month = parts.find((p) => p.type === 'month')?.value ?? '';

  const day = parts.find((p) => p.type === 'day')?.value ?? '';

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



const toBeijingText = (value: string) => {

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



type CommentViewItem = CommentItem & { pending?: boolean; optimisticPreviews?: PreviewItem[] };


function DetailImageGrid({

  items,

  alt,

  onImageClick,

}: {

  items: { url: string; type: 'image' | 'video' }[];

  alt: string;

  onImageClick: (index: number) => void;

}) {

  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;



  const renderMedia = (item: { url: string; type: 'image' | 'video' }, label: string) => {

    if (item.type === 'video') {

      return (

        <>

          <video

            className="absolute inset-0 h-full w-full object-cover pointer-events-none"

            muted

            playsInline

            preload="metadata"

            src={item.url}

          />

          <div className="absolute inset-0 flex items-center justify-center text-white/80">

            <Play size={28} />

          </div>

          <span className="sr-only">{label}</span>

        </>

      );

    }

    return <img alt={label} className="absolute inset-0 h-full w-full object-cover" src={item.url} />;

  };



  if (items.length === 1) {

    const item = items[0];

    return (

      <div className="w-full">

        <div

          className="relative aspect-square w-full cursor-pointer overflow-hidden bg-slate-950/20"

          onClick={() => onImageClick(0)}

        >

          {renderMedia(item, alt)}

        </div>

      </div>

    );

  }



  const maxVisible = 9;
  const needCollapse = items.length > maxVisible;
  const visibleItems = needCollapse && !expanded ? items.slice(0, maxVisible) : items;
  const extraCount = needCollapse && !expanded ? items.length - maxVisible : 0;

  const cols = visibleItems.length <= 2 ? 2 : 3;

  return (

    <div>

    <div className={`grid gap-0.5 ${cols === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>

      {visibleItems.map((item, i) => (

        <div

          className="relative aspect-square cursor-pointer overflow-hidden bg-slate-950/20"

          key={item.url}

          onClick={() => onImageClick(i)}

        >

          {renderMedia(item, `${alt} ${i + 1}`)}

          {extraCount > 0 && i === visibleItems.length - 1 ? (
            <div
              className="absolute inset-0 flex items-center justify-center bg-black/50 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            >
              <span className="text-2xl font-bold text-white">+{extraCount}</span>
            </div>
          ) : null}

        </div>

      ))}

    </div>

    {needCollapse && expanded ? (
      <button
        className="mt-1 w-full text-center text-xs text-soft hover:text-[var(--text-accent)] transition"
        onClick={() => setExpanded(false)}
        type="button"
      >
        收起
      </button>
    ) : null}

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

  onTagClick?: (tag: string) => void;

  onDelete?: (id: string) => Promise<void>;

  onLikeChange?: (id: string, likeCount: number, liked: boolean) => void;

  onCommentCountChange?: (id: string, delta: number) => void;

  tagCounts?: Record<string, number>;

  followed?: boolean;

  onFollowToggle?: (login: string, nextFollow: boolean, avatarUrl?: string) => Promise<void>;

}



export function CardDetail({

  item,

  fallbackAuthorLogin,

  roleLabel,

  canInteract,

  editable,

  currentUserLogin,

  onTagClick,

  onDelete,

  onLikeChange,

  onCommentCountChange,

  tagCounts,

  followed,

  onFollowToggle,

}: CardDetailProps) {

  const [comments, setComments] = useState<CommentViewItem[]>([]);

  const [commentsLoading, setCommentsLoading] = useState(false);

  const [commentBusy, setCommentBusy] = useState(false);

  const [text, setText] = useState('');

  const [files, setFiles] = useState<File[]>([]);

  const [previews, setPreviews] = useState<PreviewItem[]>([]);

  const [error, setError] = useState<string | null>(null);

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const [viewingCommentImage, setViewingCommentImage] = useState<{ items: { url: string; type: 'image' | 'video' }[]; initialIndex: number } | null>(null);

  const [likeBusy, setLikeBusy] = useState(false);

  const [followBusy, setFollowBusy] = useState(false);

  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  const [replyTarget, setReplyTarget] = useState<{ parentId: string; replyToUserLogin: string } | null>(null);



  const inputId = useId();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const commentInputRef = useRef<HTMLInputElement>(null);

  const commentInputFocusedRef = useRef(false);

  const { confirm } = useToast();
  const profile = useProfile();

  const navigate = useNavigate();

  const location = useLocation();

  const fileRef = useRef<File[]>([]);

  const previewRef = useRef<PreviewItem[]>([]);



  const replaceCommentFiles = useCallback((nextFiles: File[]) => {

    revokePreviewUrls(previewRef.current);

    const nextPreviews = createPreviewItems(nextFiles);

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
  const displayAuthorLogin = profile.resolveName(authorLogin);
  const displayAuthorAvatar = profile.resolveAvatar(authorLogin, authorAvatar);

  const imageUrls = item.imageUrls ?? [];

  const mediaItems = buildMediaItems(imageUrls, item.assetTypes);

  const tags = item.tags ?? [];

  const commentCacheKey = `${authorLogin}/${item.id}`;

  const canFollow = !!onFollowToggle && canInteract && !editable;
  const isFollowing = !!followed;

  const handleToggleFollow = async () => {
    if (!canFollow || followBusy) return;
    setFollowBusy(true);
    try {
      await onFollowToggle?.(authorLogin, !isFollowing, authorAvatar);
    } catch {
      // ignore
    } finally {
      setFollowBusy(false);
    }
  };

  const actionColumnClass =

    'grid w-20 shrink-0 grid-cols-2 items-center justify-items-start pr-0';

  const actionButtonBaseClass =

    'inline-flex h-8 w-12 items-center justify-start gap-1 pl-2 transition';



  // Lock body scroll while detail is open

  useEffect(() => {

    document.body.style.overflow = 'hidden';

    return () => {

      document.body.style.overflow = '';

    };

  }, []);



  useEffect(() => () => {

    if (commentInputFocusedRef.current) {

      setCommentInputActive(false);

      commentInputFocusedRef.current = false;

    }

  }, []);



  // Load all comments on mount

  useEffect(() => {

    let cancelled = false;

    const cached = getCommentCache(commentCacheKey);

    if (cached) {

      setComments(cached.items);

      if (!cached.stale) {

        setCommentsLoading(false);

        return () => {

          cancelled = true;

        };

      }

    }



    setCommentsLoading(true);

    api

      .getComments(authorLogin, item.id)

      .then((data) => {

        if (!cancelled) {

          setComments(data);

          setCommentCache(commentCacheKey, data);

        }

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

  }, [authorLogin, item.id, commentCacheKey]);





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



  const handleFileSelect = useCallback((incoming: FileList | null) => {

    if (!incoming || incoming.length === 0) return;

    const selectedFiles = Array.from(incoming);

    const nextFiles = [...fileRef.current, ...selectedFiles];



    if (nextFiles.length > MAX_COMMENT_FILES) {

      setError(`Up to ${MAX_COMMENT_FILES} files per comment`);

      return;

    }



    const videoCount = nextFiles.filter((file) => mediaTypeFromFile(file) === 'video').length;

    if (videoCount > MAX_COMMENT_VIDEOS) {

      setError(`Up to ${MAX_COMMENT_VIDEOS} videos per comment`);

      return;

    }



    let imageTotalSize = 0;

    for (const selected of nextFiles) {

      if (mediaTypeFromFile(selected) === 'video') {

        if (selected.size > MAX_COMMENT_VIDEO_SIZE) {

          setError(`Each video must be <= 200MB: ${selected.name}`);

          return;

        }

        continue;

      }

      if (selected.size > MAX_COMMENT_FILE_SIZE) {

        setError(`Each image must be <= 5MB: ${selected.name}`);

        return;

      }

      imageTotalSize += selected.size;

    }

    if (imageTotalSize > MAX_COMMENT_TOTAL_SIZE) {

      setError('Total image size must be <= 25MB');

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



    const replyPayload = replyTarget

      ? { parentId: replyTarget.parentId, replyToUserLogin: replyTarget.replyToUserLogin }

      : undefined;



    const optimisticPreviews = files.length > 0 ? createPreviewItems(files) : [];

    const optimisticComment: CommentViewItem = {

      id: `temp-${Date.now()}`,

      authorLogin: profile.user?.login ?? '',

      postOwner: authorLogin,

      postId: item.id,

      text: text.trim(),

      imageUrls: optimisticPreviews.map((preview) => preview.url),
      assetTypes: optimisticPreviews.map((preview) => preview.type),
      optimisticPreviews: optimisticPreviews.length > 0 ? optimisticPreviews : undefined,

      createdAt: new Date().toISOString(),

      likeCount: 0,

      liked: false,

      pending: true,

      parentId: replyPayload?.parentId ?? null,

      replyToUserLogin: replyPayload?.replyToUserLogin ?? null,

    };

    setComments((prev) => {

      const next = [...prev, optimisticComment];

      setCommentCache(commentCacheKey, next);

      return next;

    });

    onCommentCountChange?.(item.id, 1);

    const submittedText = text.trim();

    const submittedFiles = files.length > 0 ? [...files] : undefined;

    setText('');

    replaceCommentFiles([]);

    detailFileCache.delete(item.id);

    setError(null);

    setReplyTarget(null);



    try {

      const newComment = await api.addComment(authorLogin, item.id, submittedText, submittedFiles, replyPayload);

      setComments((prev) => {

        const next = prev.map((c) => {
          if (c.id !== optimisticComment.id) return c;
          if (c.optimisticPreviews) revokePreviewUrls(c.optimisticPreviews);
          return newComment;
        });

        setCommentCache(commentCacheKey, next);

        return next;

      });

    } catch (e) {

      setComments((prev) => {

        const optimistic = prev.find((c) => c.id === optimisticComment.id);
        if (optimistic?.optimisticPreviews) revokePreviewUrls(optimistic.optimisticPreviews);

        const next = prev.filter((c) => c.id !== optimisticComment.id);

        setCommentCache(commentCacheKey, next);

        return next;

      });

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

    setComments((prev) => {

      const next = prev.filter((c) => c.id !== comment.id);

      setCommentCache(commentCacheKey, next);

      return next;

    });

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

        setCommentCache(commentCacheKey, restored);

        return restored;

      });

      onCommentCountChange?.(item.id, 1);

    } finally {

      setDeletingCommentId(null);

    }

  };



  const handleReplyClick = (comment: CommentViewItem) => {

    const parentId = comment.parentId || comment.id;

    setReplyTarget({ parentId, replyToUserLogin: comment.authorLogin });

    commentInputRef.current?.focus();

  };



  const toggleCommentLike = async (commentId: string) => {

    if (!canInteract) return;

    const target = comments.find((comment) => comment.id === commentId);

    if (!target) return;



    const optimisticLiked = !target.liked;

    const optimisticCount = Math.max(0, (target.likeCount ?? 0) + (optimisticLiked ? 1 : -1));

    setComments((prev) => {

      const next = prev.map((comment) =>

        comment.id === commentId ? { ...comment, liked: optimisticLiked, likeCount: optimisticCount } : comment

      );

      setCommentCache(commentCacheKey, next);

      return next;

    });



    try {

      const result = await api.toggleCommentLike(authorLogin, item.id, commentId);

      setComments((prev) => {

        const next = prev.map((comment) =>

          comment.id === commentId ? { ...comment, liked: result.liked, likeCount: result.likeCount } : comment

        );

        setCommentCache(commentCacheKey, next);

        return next;

      });

    } catch {

      setComments((prev) => {

        const next = prev.map((comment) =>

          comment.id === commentId ? { ...comment, liked: target.liked, likeCount: target.likeCount } : comment

        );

        setCommentCache(commentCacheKey, next);

        return next;

      });

    }

  };



  const isCardOwner = currentUserLogin ? authorLogin.toLowerCase() === currentUserLogin.toLowerCase() : false;



  const { rootComments, repliesByParent } = useMemo(() => {

    const rootList: CommentViewItem[] = [];

    const replyMap = new Map<string, CommentViewItem[]>();

    const rootIds = new Set<string>();

    comments.forEach((comment) => {

      if (!comment.parentId) rootIds.add(comment.id);

    });

    comments.forEach((comment) => {

      if (comment.parentId && rootIds.has(comment.parentId)) {

        if (!replyMap.has(comment.parentId)) replyMap.set(comment.parentId, []);

        replyMap.get(comment.parentId)!.push(comment);

      } else {

        rootList.push(comment);

      }

    });

    return { rootComments: rootList, repliesByParent: replyMap };

  }, [comments]);



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

                {displayAuthorAvatar ? (

                  <img

                    alt={displayAuthorLogin || authorLogin}

                    className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/10"

                    src={displayAuthorAvatar}

                  />

                ) : (

                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-xs font-semibold text-soft ring-1 ring-white/10">

                    {(displayAuthorLogin || authorLogin).slice(0, 1).toUpperCase()}

                  </span>

                )}

                <p className="flex min-w-0 flex-1 items-center gap-2 truncate text-sm font-medium text-[var(--text-main)]">

                  {displayAuthorLogin || authorLogin}

                  {roleLabel ? (

                    <span className="rounded-full bg-white/8 px-2 py-0.5 text-xs text-soft">{roleLabel}</span>

                  ) : null}

                </p>

              </div>

              {/* Right: edit/delete (top), like/comment (bottom) –but here only top row */}

              {editable ? (

                <div className={`${actionColumnClass} opacity-100 transition md:opacity-0 md:group-hover:opacity-100`}>

                  <button

                    aria-label="修改卡片"

                    className={`${actionButtonBaseClass} text-soft hover:text-[var(--text-main)]`}

                    onClick={() => {

                      navigate(`/post?id=${item.id}`, { state: { from: `${location.pathname}${location.search}` } });

                    }}

                    type="button"

                  >

                    <PencilLine size={14} />

                  </button>

                  <button

                    aria-label="删除卡片"

                    className={`${actionButtonBaseClass} text-rose-300 hover:text-rose-200`}

                    onClick={handleDeleteItem}

                    type="button"

                  >

                    <Trash2 size={14} />

                  </button>

                </div>

              ) : canFollow ? (

                <div className={actionColumnClass}>
                  <div className="col-span-2 flex w-full justify-end pr-2">
                    <FollowButton
                      following={isFollowing}
                      disabled={followBusy}
                      onClick={() => void handleToggleFollow()}
                    />
                  </div>
                </div>

              ) : (

                <div className={actionColumnClass}>

                  <div className="h-8 w-12" />

                  <div className="h-8 w-12" />

                </div>

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

              <div className="mt-2 px-2">

                <DetailImageGrid alt={item.description} onImageClick={setViewerIndex} items={mediaItems} />

              </div>

            ) : null}



            {tags.length > 0 ? (

              <div className="mt-3 flex flex-wrap gap-2 px-4">

                {tags.map((tag) => {

                  const count = tagCounts?.[tag.trim().toLowerCase()] ?? 0;

                  return (

                    <button

                      className="tag-chip rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-200 transition hover:text-[var(--text-main)]"

                      key={tag}

                      onClick={() => onTagClick?.(tag)}

                      type="button"

                    >

                      #{tag} ({count})

                    </button>

                  );

                })}

              </div>

            ) : null}



            {/* Time + like + comment –same 2-column alignment */}

            <div className="flex px-2">

              <div className="min-w-0 flex-1 px-2 pt-3">

                <p className="text-xs text-soft">{toDisplayTime(item)}</p>

              </div>

              <div className={`${actionColumnClass} items-end pb-1`}>

                <button

                  className={`${actionButtonBaseClass} ${item.liked ? 'text-rose-400' : 'text-soft hover:text-rose-300'}`}

                  disabled={!canInteract || likeBusy}

                  onClick={() => void handleToggleLike()}

                  type="button"

                >

                  <Heart className={item.liked ? 'fill-current' : ''} size={14} />

                  {item.likeCount > 0 ? <span className="text-[10px] leading-none">{item.likeCount}</span> : null}

                </button>

                <button

                  className={`${actionButtonBaseClass} text-soft hover:text-[var(--text-main)]`}

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

                  {rootComments.map((c) => {

                    const canDelete = currentUserLogin && (

                      c.authorLogin.toLowerCase() === currentUserLogin.toLowerCase() || isCardOwner

                    );

                    const replies = repliesByParent.get(c.id) ?? [];

                    const liked = !!c.liked;
                    const commentAuthor = profile.resolveName(c.authorLogin);
                    const commentAvatar = profile.resolveAvatar(
                      c.authorLogin,
                      `https://github.com/${c.authorLogin}.png?size=48`
                    );

                    return (

                      <div className="px-4 py-3" key={c.id}>

                        <div className="flex gap-3">

                          <img

                            alt={commentAuthor || c.authorLogin}

                            className="mt-0.5 h-8 w-8 shrink-0 rounded-full object-cover"

                            src={commentAvatar}

                          />

                          <div className="min-w-0 flex-1">

                            <div className="flex flex-wrap items-baseline gap-x-2">

                              <span className="text-sm font-medium text-[var(--text-main)]">{commentAuthor || c.authorLogin}</span>

                              <span className="text-xs text-soft">{toCommentTime(c.createdAt)}</span>

                              {c.pending ? <LoaderCircle className="animate-spin text-soft" size={12} /> : null}

                            </div>

                            {c.text ? (

                              <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--text-main)]">{c.text}</p>

                            ) : null}

                            {c.imageUrls && c.imageUrls.length > 0 ? (

                              <div className="mt-2 grid max-w-56 grid-cols-3 gap-1">

                                {buildMediaItems(c.imageUrls, c.assetTypes).map((media, index) => (

                                  <div

                                    className="relative h-20 w-full cursor-pointer overflow-hidden rounded bg-slate-950/30"

                                    key={`${c.id}-${media.url}`}

                                    onClick={() => setViewingCommentImage({ items: buildMediaItems(c.imageUrls!, c.assetTypes), initialIndex: index })}

                                  >

                                    {media.type === 'video' ? (

                                      <>

                                        <video

                                          className="absolute inset-0 h-full w-full object-cover pointer-events-none"

                                          muted

                                          playsInline

                                          preload="metadata"

                                          src={media.url}

                                        />

                                        <div className="absolute inset-0 flex items-center justify-center text-white/80">

                                          <Play size={16} />

                                        </div>

                                      </>

                                    ) : (

                                      <img

                                        alt="comment media"

                                        className="absolute inset-0 h-full w-full object-cover"

                                        src={media.url}

                                      />

                                    )}

                                  </div>

                                ))}

                              </div>

                            ) : null}

                            <div className="mt-2 flex items-center gap-3 text-soft">

                              <button

                                className={`inline-flex items-center gap-1 text-xs transition ${liked ? 'text-rose-300' : 'hover:text-rose-300'}`}

                                onClick={() => toggleCommentLike(c.id)}

                                type="button"

                              >

                                <Heart className={liked ? 'fill-current' : ''} size={13} />

                                {c.likeCount && c.likeCount > 0 ? (

                                  <span className="text-[10px] leading-none">{c.likeCount}</span>

                                ) : null}

                              </button>

                              <button

                                className="inline-flex items-center gap-1 text-xs hover:text-[var(--text-main)] transition"

                                onClick={() => handleReplyClick(c)}

                                type="button"

                              >

                                <CornerUpLeft size={13} />

                              </button>

                              {canDelete ? (

                                <button

                                  aria-label="删除评论"

                                  className="ml-auto inline-flex h-7 w-7 items-center justify-center text-soft transition hover:text-rose-300"

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

                          </div>

                        </div>



                        {replies.length > 0 ? (

                          <div className="mt-2 space-y-2 pl-8">

                            {replies.map((reply) => {

                              const replyTarget = getReplyTargetLabel(reply);
                              const replyAuthor = profile.resolveName(reply.authorLogin);
                              const replyTargetDisplay = replyTarget ? profile.resolveName(replyTarget) : null;
                              const replyAvatar = profile.resolveAvatar(
                                reply.authorLogin,
                                `https://github.com/${reply.authorLogin}.png?size=48`
                              );

                              const line = replyTarget

                                ? `${replyAuthor || reply.authorLogin} 回复 ${replyTargetDisplay || replyTarget}: ${reply.text ?? ''}`.trim()

                                : `${replyAuthor || reply.authorLogin}: ${reply.text ?? ''}`.trim();

                              const replyLiked = !!reply.liked;

                              const canDeleteReply = currentUserLogin && (

                                reply.authorLogin.toLowerCase() === currentUserLogin.toLowerCase() || isCardOwner

                              );

                              return (

                                <div className="flex gap-2" key={reply.id}>

                                  <img

                                    alt={replyAuthor || reply.authorLogin}

                                    className="mt-0.5 h-6 w-6 shrink-0 rounded-full object-cover"

                                    src={replyAvatar}

                                  />

                                  <div className="min-w-0 flex-1">

                                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-soft">

                                      <span className="text-sm text-[var(--text-main)] break-words">{line}</span>

                                      <span>{toCommentTime(reply.createdAt)}</span>

                                      {reply.pending ? <LoaderCircle className="animate-spin" size={12} /> : null}

                                    </div>

                                    {reply.imageUrls && reply.imageUrls.length > 0 ? (

                                      <div className="mt-1 grid max-w-56 grid-cols-3 gap-1">

                                        {buildMediaItems(reply.imageUrls, reply.assetTypes).map((media, index) => (

                                          <div

                                            className="relative h-16 w-full cursor-pointer overflow-hidden rounded bg-slate-950/30"

                                            key={`${reply.id}-${media.url}`}

                                            onClick={() => setViewingCommentImage({ items: buildMediaItems(reply.imageUrls!, reply.assetTypes), initialIndex: index })}

                                          >

                                            {media.type === 'video' ? (

                                              <>

                                                <video

                                                  className="absolute inset-0 h-full w-full object-cover pointer-events-none"

                                                  muted

                                                  playsInline

                                                  preload="metadata"

                                                  src={media.url}

                                                />

                                                <div className="absolute inset-0 flex items-center justify-center text-white/80">

                                                  <Play size={14} />

                                                </div>

                                              </>

                                            ) : (

                                              <img

                                                alt="comment media"

                                                className="absolute inset-0 h-full w-full object-cover"

                                                src={media.url}

                                              />

                                            )}

                                          </div>

                                        ))}

                                      </div>

                                    ) : null}

                                    <div className="flex items-center gap-3 text-soft">

                                      <button

                                        className={`inline-flex items-center gap-1 text-xs transition ${replyLiked ? 'text-rose-300' : 'hover:text-rose-300'}`}

                                        onClick={() => toggleCommentLike(reply.id)}

                                        type="button"

                                      >

                                        <Heart className={replyLiked ? 'fill-current' : ''} size={12} />

                                        {reply.likeCount && reply.likeCount > 0 ? (

                                          <span className="text-[10px] leading-none">{reply.likeCount}</span>

                                        ) : null}

                                      </button>

                                      <button

                                        className="inline-flex items-center gap-1 text-xs hover:text-[var(--text-main)] transition"

                                        onClick={() => handleReplyClick(reply)}

                                        type="button"

                                      >

                                        <CornerUpLeft size={12} />

                                      </button>

                                      {canDeleteReply ? (

                                        <button

                                          aria-label="删除评论"

                                          className="ml-auto inline-flex h-6 w-6 items-center justify-center text-soft transition hover:text-rose-300"

                                          disabled={deletingCommentId === reply.id}

                                          onClick={() => {

                                            confirm('确定要删除这条评论吗？', () => { void handleDeleteComment(reply); });

                                          }}

                                          type="button"

                                        >

                                          {deletingCommentId === reply.id ? <LoaderCircle className="animate-spin" size={12} /> : <Trash2 size={12} />}

                                        </button>

                                      ) : null}

                                    </div>

                                  </div>

                                </div>

                              );

                            })}

                          </div>

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

            {replyTarget ? (

              <div className="mb-2 flex items-center gap-2 text-xs text-soft">

                <span>回复 {replyTarget.replyToUserLogin}</span>

                <button

                  className="inline-flex items-center gap-1 text-xs text-soft hover:text-[var(--text-main)] transition"

                  onClick={() => setReplyTarget(null)}

                  type="button"

                >

                  <X size={12} />

                  取消回复

                </button>

              </div>

            ) : null}

            {previews.length > 0 ? (

              <div className="mb-2 grid grid-cols-3 gap-2">

                {previews.map((preview, index) => (

                  <div className="relative inline-block" key={`${preview.url}-${index}`}>

                    {preview.type === 'video' ? (
                      <>
                        <video
                          className="h-16 w-full rounded object-cover"
                          muted
                          playsInline
                          preload="metadata"
                          src={preview.url}
                        />
                        <div className="absolute inset-0 flex items-center justify-center text-white/80">
                          <Play size={14} />
                        </div>
                      </>
                    ) : (
                      <img alt="" className="h-16 w-full rounded object-cover" src={preview.url} />
                    )}

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

                accept="image/*,video/*"

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

                onBlur={() => {

                  if (commentInputFocusedRef.current) {

                    setCommentInputActive(false);

                    commentInputFocusedRef.current = false;

                  }

                }}

                onChange={(e) => setText(e.target.value)}

                onFocus={() => {

                  if (!commentInputFocusedRef.current) {

                    setCommentInputActive(true);

                    commentInputFocusedRef.current = true;

                  }

                }}

                onKeyDown={(e) => {

                  if (e.key === 'Enter' && !e.shiftKey) {

                    e.preventDefault();

                    void handleAddComment();

                  }

                }}

                placeholder={replyTarget ? `回复 ${replyTarget.replyToUserLogin}...` : '写评论..'}

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



      {/* Image viewer lightbox */}

      {viewerIndex !== null ? (

        <ImageViewer initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} items={mediaItems} />

      ) : null}



      {/* Comment image viewer */}

      {viewingCommentImage ? (

        <ImageViewer

          initialIndex={viewingCommentImage.initialIndex}

          onClose={() => setViewingCommentImage(null)}

          items={viewingCommentImage.items}

        />

      ) : null}

    </>

  );

}

