import { useId, useState, useRef, useCallback, useEffect } from 'react';
import { Trash2, X, Plus } from 'lucide-react';

interface PostDialogProps {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  mode: 'create' | 'edit';
  initialDescription?: string;
  initialTimeMode?: 'point' | 'range';
  initialStartAt?: string;
  initialEndAt?: string;
  initialImageUrls?: string[];
  onSubmit: (data: { description: string; timeMode: 'point' | 'range'; startAt: string; endAt?: string; files: File[]; removedUrls?: string[] }) => Promise<void>;
}

const MAX_FILES = 9;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_TOTAL_SIZE = 25 * 1024 * 1024;
const DRAFT_KEY = 'draft:post';

const getDefaultDateTime = () => {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(new Date()).replace(' ', 'T');
};

interface PreviewItem {
  type: 'file' | 'url';
  file?: File;
  url: string;
}

export function PostDialog({
  open,
  onClose,
  busy,
  mode,
  initialDescription = '',
  initialTimeMode = 'point',
  initialStartAt,
  initialEndAt,
  initialImageUrls = [],
  onSubmit,
}: PostDialogProps) {
  const descriptionId = useId();
  const startTimeId = useId();
  const endTimeId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [description, setDescription] = useState(initialDescription);
  const [timeMode, setTimeMode] = useState<'point' | 'range'>(initialTimeMode);
  const [startAt, setStartAt] = useState(initialStartAt ?? getDefaultDateTime());
  const [endAt, setEndAt] = useState(initialEndAt ?? initialStartAt ?? getDefaultDateTime());
  const [previews, setPreviews] = useState<PreviewItem[]>(() =>
    initialImageUrls.map((url) => ({ type: 'url' as const, url }))
  );
  const [error, setError] = useState<string | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [overDelete, setOverDelete] = useState(false);
  const deleteZoneRef = useRef<HTMLDivElement>(null);
  const prevOpenRef = useRef(false);
  const [animating, setAnimating] = useState(false);
  const [visible, setVisible] = useState(false);

  // Stable key for initialImageUrls to avoid re-triggering effect
  const initialUrlsKey = initialImageUrls.join(',');

  // Reset state only when dialog freshly opens (false → true)
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      if (mode === 'create') {
        try {
          const saved = localStorage.getItem(DRAFT_KEY);
          if (saved) {
            const d = JSON.parse(saved) as { description?: string; timeMode?: 'point' | 'range'; startAt?: string; endAt?: string };
            setDescription(d.description ?? initialDescription);
            setTimeMode(d.timeMode ?? initialTimeMode);
            setStartAt(d.startAt ?? initialStartAt ?? getDefaultDateTime());
            setEndAt(d.endAt ?? initialEndAt ?? initialStartAt ?? getDefaultDateTime());
          } else {
            setDescription(initialDescription);
            setTimeMode(initialTimeMode);
            setStartAt(initialStartAt ?? getDefaultDateTime());
            setEndAt(initialEndAt ?? initialStartAt ?? getDefaultDateTime());
          }
        } catch {
          setDescription(initialDescription);
          setTimeMode(initialTimeMode);
          setStartAt(initialStartAt ?? getDefaultDateTime());
          setEndAt(initialEndAt ?? initialStartAt ?? getDefaultDateTime());
        }
      } else {
        setDescription(initialDescription);
        setTimeMode(initialTimeMode);
        setStartAt(initialStartAt ?? getDefaultDateTime());
        setEndAt(initialEndAt ?? initialStartAt ?? getDefaultDateTime());
      }
      setPreviews(initialImageUrls.map((url) => ({ type: 'url' as const, url })));
      setError(null);
      setDraggingIndex(null);
      setOverDelete(false);
    }
    prevOpenRef.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialDescription, initialEndAt, initialStartAt, initialTimeMode, initialUrlsKey, mode]);

  // Persist create-mode draft to localStorage whenever fields change
  useEffect(() => {
    if (mode !== 'create') return;
    if (description.trim() || timeMode !== 'point') {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ description, timeMode, startAt, endAt }));
    } else {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [description, timeMode, startAt, endAt, mode]);

  // Animation: mount → animate in, close → animate out → unmount
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

  const addFiles = useCallback(
    (incoming: FileList | null) => {
      if (!incoming) return;
      const newItems: PreviewItem[] = Array.from(incoming).map((f) => ({
        type: 'file' as const,
        file: f,
        url: URL.createObjectURL(f),
      }));
      const next = [...previews, ...newItems].slice(0, MAX_FILES);

      let totalSize = 0;
      for (const item of next) {
        if (item.file) {
          if (item.file.size > MAX_FILE_SIZE) {
            setError(`单张图片不能超过 5MB: ${item.file.name}`);
            return;
          }
          totalSize += item.file.size;
        }
      }
      if (totalSize > MAX_TOTAL_SIZE) {
        setError('帖子总大小不能超过 25MB');
        return;
      }
      setError(null);
      setPreviews(next);
    },
    [previews]
  );

  const removePreview = useCallback((index: number) => {
    setPreviews((prev) => {
      const item = prev[index];
      if (item?.type === 'file') URL.revokeObjectURL(item.url);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleSubmit = async () => {
    if (!startAt) {
      setError('请填写开始时间');
      return;
    }
    if (timeMode === 'range' && !endAt) {
      setError('请填写结束时间');
      return;
    }
    if (timeMode === 'range' && new Date(endAt).getTime() < new Date(startAt).getTime()) {
      setError('结束时间不能早于开始时间');
      return;
    }
    if (!description.trim() && previews.length === 0) {
      setError('请输入文字或选择图片');
      return;
    }
    try {
      const files = previews.filter((p) => p.type === 'file').map((p) => p.file!);
      const removedUrls = initialImageUrls.filter(
        (url) => !previews.some((p) => p.type === 'url' && p.url === url)
      );
      await onSubmit({
        description: description.trim(),
        timeMode,
        startAt: `${startAt}:00+08:00`,
        endAt: timeMode === 'range' ? `${endAt}:00+08:00` : undefined,
        files,
        removedUrls: removedUrls.length > 0 ? removedUrls : undefined,
      });
      if (mode === 'create') localStorage.removeItem(DRAFT_KEY);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '提交失败');
    }
  };

  // Drag handling
  const handleDragStart = (index: number) => {
    setDraggingIndex(index);
  };

  const handleDragEnd = () => {
    if (overDelete && draggingIndex !== null) {
      removePreview(draggingIndex);
    }
    setDraggingIndex(null);
    setOverDelete(false);
  };

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (draggingIndex === null || !deleteZoneRef.current) return;
      const touch = e.touches[0];
      const rect = deleteZoneRef.current.getBoundingClientRect();
      const isOver =
        touch.clientX >= rect.left &&
        touch.clientX <= rect.right &&
        touch.clientY >= rect.top &&
        touch.clientY <= rect.bottom;
      setOverDelete(isOver);
    },
    [draggingIndex]
  );

  const handleTouchEnd = useCallback(() => {
    if (overDelete && draggingIndex !== null) {
      removePreview(draggingIndex);
    }
    setDraggingIndex(null);
    setOverDelete(false);
  }, [overDelete, draggingIndex, removePreview]);

  if (!open && !animating) return null;

  const totalPreviews = previews.length;
  const cols = totalPreviews <= 2 ? 2 : 3;

  return (
    <div className={`fixed inset-0 z-50 flex flex-col md:items-center md:justify-center transition-colors duration-250 ${visible ? 'bg-[var(--page-bg)] md:bg-slate-950/65' : 'bg-transparent md:bg-transparent'}`}>
      <div className={`flex h-full w-full flex-col bg-[var(--page-bg)] transition-all duration-250 md:h-auto md:max-h-[90vh] md:max-w-lg md:border md:border-[var(--panel-border)] md:bg-[var(--panel-bg)] md:backdrop-blur-xl ${visible ? 'translate-y-0 opacity-100 md:scale-100' : 'translate-y-full opacity-100 md:translate-y-0 md:scale-95 md:opacity-0'}`}>
        {/* Header bar */}
        <div className="flex shrink-0 items-center justify-between px-4 py-3">
          <button
            className="text-sm text-soft hover:text-[var(--text-main)] transition"
            onClick={onClose}
            type="button"
          >
            取消
          </button>
          <button
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
            disabled={busy}
            onClick={() => void handleSubmit()}
            type="button"
          >
            {busy ? '提交中...' : mode === 'create' ? '发表' : '修改'}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {/* Description */}
          <textarea
            className="min-h-20 w-full resize-none bg-transparent text-base text-[var(--text-main)] outline-none placeholder:text-soft/50"
            id={descriptionId}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="記錄一下..."
            value={description}
          />

          {/* Image previews grid */}
          <div
            className={`mt-3 grid gap-0.5 ${totalPreviews === 0 ? '' : cols === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}
            onDragOver={(e) => e.preventDefault()}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {previews.map((item, i) => (
              <div
                className={`relative aspect-square overflow-hidden bg-slate-950/20 cursor-grab active:cursor-grabbing ${
                  draggingIndex === i ? 'opacity-40' : ''
                }`}
                draggable
                key={`${item.url}-${i}`}
                onDragStart={() => handleDragStart(i)}
                onDragEnd={handleDragEnd}
                onTouchStart={() => handleDragStart(i)}
              >
                <img
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  src={item.url}
                />
                <button
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/80 hover:text-white"
                  onClick={() => removePreview(i)}
                  type="button"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {totalPreviews < MAX_FILES ? (
              <div
                className="flex aspect-square cursor-pointer items-center justify-center bg-slate-950/30 hover:bg-slate-950/40 transition"
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus className="text-soft" size={32} />
              </div>
            ) : null}
          </div>

          <input
            accept="image/*"
            className="hidden"
            multiple
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
            ref={fileInputRef}
            type="file"
          />

          {/* Time */}
          <div className="mt-4">
            <div className="mb-3 flex gap-2 text-sm">
              <button
                className={`rounded px-3 py-1.5 transition ${timeMode === 'point' ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/40' : 'bg-white/5 text-soft hover:text-[var(--text-main)]'}`}
                onClick={() => setTimeMode('point')}
                type="button"
              >
                时间点
              </button>
              <button
                className={`rounded px-3 py-1.5 transition ${timeMode === 'range' ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/40' : 'bg-white/5 text-soft hover:text-[var(--text-main)]'}`}
                onClick={() => setTimeMode('range')}
                type="button"
              >
                持续时间
              </button>
            </div>
            <input
              className="w-full border border-white/10 bg-transparent px-3 py-2 text-sm text-[var(--text-main)] outline-none transition focus:border-[var(--text-accent)]"
              id={startTimeId}
              onChange={(e) => setStartAt(e.target.value)}
              type="datetime-local"
              value={startAt}
            />
            {timeMode === 'range' ? (
              <input
                className="mt-2 w-full border border-white/10 bg-transparent px-3 py-2 text-sm text-[var(--text-main)] outline-none transition focus:border-[var(--text-accent)]"
                id={endTimeId}
                onChange={(e) => setEndAt(e.target.value)}
                type="datetime-local"
                value={endAt}
              />
            ) : null}
          </div>

          {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
        </div>

        {/* Drag-to-delete zone */}
        {draggingIndex !== null ? (
          <div
            className={`shrink-0 flex items-center justify-center gap-2 py-4 text-sm transition-colors ${
              overDelete ? 'bg-rose-700 text-white' : 'bg-rose-600/70 text-rose-100'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setOverDelete(true);
            }}
            onDragLeave={() => setOverDelete(false)}
            onDrop={() => {
              if (draggingIndex !== null) removePreview(draggingIndex);
              setDraggingIndex(null);
              setOverDelete(false);
            }}
            ref={deleteZoneRef}
          >
            <Trash2 size={18} />
            <span>拖动到此处删除</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
