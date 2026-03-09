import { useEffect, useId, useRef, useState, useCallback } from 'react';
import { ImagePlus, LoaderCircle, Send, X } from 'lucide-react';
import { ImageViewer } from './ImageViewer';
import type { CommentItem } from '../types/image';

interface CommentDialogProps {
  open: boolean;
  onClose: () => void;
  comments: CommentItem[];
  loading: boolean;
  busy: boolean;
  onSubmit: (text: string, file?: File) => Promise<void>;
  canComment: boolean;
}

const toBeijingText = (value: string) => {
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

export function CommentDialog({ open, onClose, comments, loading, busy, onSubmit, canComment }: CommentDialogProps) {
  const inputId = useId();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  const [visible, setVisible] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setText('');
      setFile(null);
      setPreview(null);
      setError(null);
    }
    prevOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (open) {
      setAnimating(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      const timer = setTimeout(() => setAnimating(false), 250);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Auto-scroll to bottom on new comments
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [comments.length]);

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

  const handleSubmit = async () => {
    if (!text.trim() && !file) return;
    try {
      await onSubmit(text.trim(), file ?? undefined);
      setText('');
      removeFile();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '评论失败');
    }
  };

  if (!open && !animating) return null;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 transition-colors duration-250 ${visible ? '' : ''}`}
      style={{ top: '75vh' }}
    >
      {/* Backdrop - clickable to dismiss */}
      {visible && (
        <div className="fixed inset-0 z-40" onClick={onClose} />
      )}

      <div
        className={`relative z-50 flex h-full w-full flex-col border-t border-[var(--panel-border)] bg-[var(--page-bg)] shadow-lg transition-transform duration-250 ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-4 py-2">
          <p className="text-sm font-medium text-[var(--text-main)]">评论</p>
          <button
            className="text-sm text-soft hover:text-[var(--text-main)] transition"
            onClick={onClose}
            type="button"
          >
            取消
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-4 pb-2" ref={listRef}>
          {loading ? (
            <div className="flex min-h-16 items-center justify-center">
              <LoaderCircle className="animate-spin text-cyan-300" size={20} />
            </div>
          ) : comments.length === 0 ? (
            <p className="py-4 text-center text-sm text-soft">暂无评论</p>
          ) : (
            <div className="space-y-2.5">
              {comments.map((c) => (
                <div className="flex gap-2" key={c.id}>
                  <img
                    alt={c.authorLogin}
                    className="mt-0.5 h-5 w-5 shrink-0 rounded-full object-cover"
                    src={`https://github.com/${c.authorLogin}.png?size=48`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-soft">
                      <span className="font-medium text-[var(--text-main)]">{c.authorLogin}</span>
                      <span>：</span>
                      <span className="ml-1">{toBeijingText(c.createdAt)}</span>
                    </p>
                    {c.text ? (
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--text-main)]">{c.text}</p>
                    ) : null}
                    {c.imageUrl ? (
                      <img
                        alt="评论图片"
                        className="mt-1 max-h-32 max-w-48 rounded object-cover cursor-pointer"
                        onClick={() => setViewingImage(c.imageUrl!)}
                        src={c.imageUrl}
                      />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
          {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
        </div>

        {/* Input bar */}
        {canComment ? (
          <div className="shrink-0 border-t border-[var(--panel-border)] px-4 py-2">
            {/* Image preview */}
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
                disabled={busy}
                id={inputId}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSubmit();
                  }
                }}
                placeholder="写评论..."
                value={text}
              />
              <button
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-cyan-300 transition hover:text-cyan-200 disabled:opacity-50"
                disabled={busy || (!text.trim() && !file)}
                onClick={() => void handleSubmit()}
                type="button"
              >
                {busy ? <LoaderCircle className="animate-spin" size={18} /> : <Send size={18} />}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Image viewer for comment images */}
      {viewingImage ? (
        <ImageViewer onClose={() => setViewingImage(null)} urls={[viewingImage]} />
      ) : null}
    </div>
  );
}
