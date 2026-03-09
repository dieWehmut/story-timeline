import { useEffect, useId, useRef, useState } from 'react';
import { LoaderCircle, Send } from 'lucide-react';
import type { CommentItem } from '../types/image';

interface CommentDialogProps {
  open: boolean;
  onClose: () => void;
  comments: CommentItem[];
  loading: boolean;
  busy: boolean;
  onSubmit: (text: string) => Promise<void>;
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
  const [error, setError] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  const [visible, setVisible] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setText('');
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

  const handleSubmit = async () => {
    if (!text.trim()) return;
    try {
      await onSubmit(text.trim());
      setText('');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '评论失败');
    }
  };

  if (!open && !animating) return null;

  return (
    <div className={`fixed inset-0 z-50 flex flex-col md:items-center md:justify-center transition-colors duration-250 ${visible ? 'bg-[var(--page-bg)] md:bg-slate-950/65' : 'bg-transparent md:bg-transparent'}`}>
      <div className={`flex h-full w-full flex-col bg-[var(--page-bg)] transition-all duration-250 md:h-auto md:max-h-[80vh] md:min-h-[320px] md:max-w-lg md:border md:border-[var(--panel-border)] md:bg-[var(--panel-bg)] md:backdrop-blur-xl ${visible ? 'translate-y-0 opacity-100 md:scale-100' : 'translate-y-full opacity-100 md:translate-y-0 md:scale-95 md:opacity-0'}`}>
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-4 py-3">
          <p className="text-sm font-medium text-[var(--text-main)]">评论</p>
          <button
            className="text-sm text-soft hover:text-[var(--text-main)] transition"
            onClick={onClose}
            type="button"
          >
            关闭
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-4 pb-2" ref={listRef}>
          {loading ? (
            <div className="flex min-h-32 items-center justify-center">
              <LoaderCircle className="animate-spin text-cyan-300" size={22} />
            </div>
          ) : comments.length === 0 ? (
            <p className="py-8 text-center text-sm text-soft">暂无评论</p>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div className="flex gap-2" key={c.id}>
                  <img
                    alt={c.authorLogin}
                    className="mt-0.5 h-6 w-6 shrink-0 rounded-full object-cover"
                    src={`https://github.com/${c.authorLogin}.png?size=48`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-soft">
                      <span className="font-medium text-[var(--text-main)]">{c.authorLogin}</span>
                      <span className="ml-2">{toBeijingText(c.createdAt)}</span>
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--text-main)]">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
        </div>

        {/* Input bar */}
        {canComment ? (
          <div className="shrink-0 border-t border-[var(--panel-border)] px-4 py-3">
            <div className="flex items-center gap-2">
              <input
                className="flex-1 border border-white/10 bg-transparent px-3 py-2 text-sm text-[var(--text-main)] outline-none transition placeholder:text-soft/50 focus:border-[var(--text-accent)]"
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
                className="inline-flex h-9 w-9 items-center justify-center text-cyan-300 transition hover:text-cyan-200 disabled:opacity-50"
                disabled={busy || !text.trim()}
                onClick={() => void handleSubmit()}
                type="button"
              >
                {busy ? <LoaderCircle className="animate-spin" size={18} /> : <Send size={18} />}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
