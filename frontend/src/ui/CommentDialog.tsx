import { useEffect, useId, useRef, useState, useCallback } from 'react';
import { ImagePlus, LoaderCircle, Send, X } from 'lucide-react';

interface CommentDialogProps {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  draftKey?: string;
  onSubmit: (text: string, file?: File) => Promise<void>;
  canComment: boolean;
}

export function CommentDialog({ open, onClose, busy, draftKey, onSubmit, canComment }: CommentDialogProps) {
  const inputId = useId();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  const [visible, setVisible] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      if (draftKey) {
        try {
          const saved = localStorage.getItem(`draft:comment:${draftKey}`);
          setText(saved ? ((JSON.parse(saved) as { text?: string }).text ?? '') : '');
        } catch {
          setText('');
        }
      } else {
        setText('');
      }
      setFile(null);
      setPreview(null);
      setError(null);
    }
    prevOpenRef.current = open;
  }, [open, draftKey]);

  // Persist draft text to localStorage whenever it changes
  useEffect(() => {
    if (!draftKey) return;
    if (text) {
      localStorage.setItem(`draft:comment:${draftKey}`, JSON.stringify({ text }));
    } else {
      localStorage.removeItem(`draft:comment:${draftKey}`);
    }
  }, [text, draftKey]);

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
      if (draftKey) localStorage.removeItem(`draft:comment:${draftKey}`);
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
      className={`fixed inset-x-0 bottom-0 z-50`}
      style={{ top: 'auto' }}
    >
      {/* Backdrop */}
      {visible && (
        <div className="fixed inset-0 z-40" onClick={onClose} />
      )}

      <div
        className={`relative z-50 w-full border-t border-[var(--panel-border)] bg-[var(--page-bg)] shadow-lg transition-transform duration-250 ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Error */}
        {error ? <p className="px-4 pt-2 text-xs text-rose-300">{error}</p> : null}

        {/* Image preview */}
        {preview ? (
          <div className="relative mx-4 mt-2 inline-block">
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

        {/* Input bar */}
        <div className="flex items-center gap-2 px-3 py-2">
          {canComment ? (
            <>
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
                autoFocus
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
            </>
          ) : (
            <p className="flex-1 py-2 text-center text-sm text-soft">登录后才能评论</p>
          )}
          <button
            className="shrink-0 text-sm text-soft transition hover:text-[var(--text-main)]"
            onClick={onClose}
            type="button"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
