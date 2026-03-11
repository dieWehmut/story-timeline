import { useEffect, useId, useRef, useState, useCallback } from 'react';
import { ImagePlus, LoaderCircle, Send, X } from 'lucide-react';

// Module-level cache: persists draft files across dialog open/close within a session
const commentFileCache = new Map<string, File[]>();
const MAX_COMMENT_FILES = 3;
const MAX_COMMENT_FILE_SIZE = 5 * 1024 * 1024;
const MAX_COMMENT_TOTAL_SIZE = 25 * 1024 * 1024;

const createPreviewUrls = (files: File[]) => files.map((file) => URL.createObjectURL(file));
const revokePreviewUrls = (urls: string[]) => {
  urls.forEach((url) => URL.revokeObjectURL(url));
};

interface CommentDialogProps {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  draftKey?: string;
  onSubmit: (text: string, files?: File[]) => Promise<void>;
  canComment: boolean;
}

export function CommentDialog({ open, onClose, busy, draftKey, onSubmit, canComment }: CommentDialogProps) {
  const inputId = useId();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  const [visible, setVisible] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevOpenRef = useRef(false);
  const fileRef = useRef<File[]>([]);
  const previewRef = useRef<string[]>([]);

  const replaceFiles = useCallback((nextFiles: File[]) => {
    revokePreviewUrls(previewRef.current);
    const nextPreviews = createPreviewUrls(nextFiles);
    setFiles(nextFiles);
    setPreviews(nextPreviews);
  }, []);

  useEffect(() => { fileRef.current = files; }, [files]);
  useEffect(() => { previewRef.current = previews; }, [previews]);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      if (draftKey) {
        try {
          const saved = localStorage.getItem(`draft:comment:${draftKey}`);
          setText(saved ? ((JSON.parse(saved) as { text?: string }).text ?? '') : '');
        } catch {
          setText('');
        }
        // Restore draft file from session cache
        const cachedFiles = commentFileCache.get(draftKey);
        if (cachedFiles && cachedFiles.length > 0) {
          replaceFiles(cachedFiles);
          commentFileCache.delete(draftKey);
        } else {
          replaceFiles([]);
        }
      } else {
        setText('');
        replaceFiles([]);
      }
      setError(null);
    } else if (!open && prevOpenRef.current) {
      // Dialog closing without submit: cache the draft file for next open
      if (draftKey && fileRef.current.length > 0) {
        commentFileCache.set(draftKey, fileRef.current);
      } else if (draftKey) {
        commentFileCache.delete(draftKey);
      }
    }
    prevOpenRef.current = open;
  }, [open, draftKey, replaceFiles]);

  useEffect(() => () => {
    revokePreviewUrls(previewRef.current);
  }, []);

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

    replaceFiles(nextFiles);
    setError(null);
  }, [replaceFiles]);

  const removeFile = useCallback((index: number) => {
    replaceFiles(fileRef.current.filter((_, currentIndex) => currentIndex !== index));
  }, [replaceFiles]);

  const handleSubmit = async () => {
    if (!text.trim() && files.length === 0) return;
    try {
      await onSubmit(text.trim(), files.length > 0 ? files : undefined);
      if (draftKey) {
        localStorage.removeItem(`draft:comment:${draftKey}`);
        commentFileCache.delete(draftKey);
      }
      setText('');
      replaceFiles([]);
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
        {previews.length > 0 ? (
          <div className="mx-4 mt-2 grid grid-cols-3 gap-2">
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
                multiple
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
                className="send-icon inline-flex h-9 w-9 shrink-0 items-center justify-center text-cyan-300 transition hover:text-cyan-200 disabled:opacity-50"
                disabled={busy || (!text.trim() && files.length === 0)}
                onClick={() => void handleSubmit()}
                type="button"
              >
                {busy ? <LoaderCircle className="animate-spin" size={18} /> : <Send size={18} />}
              </button>
            </>
          ) : (
            <p className="flex-1 py-2 text-center text-sm text-soft">登录后才能评论</p>
          )}
        </div>
      </div>
    </div>
  );
}
