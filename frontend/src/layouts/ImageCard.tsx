import { useId, useState } from 'react';
import { PencilLine, Save, Trash2, X } from 'lucide-react';
import type { ImageItem, UpdateImagePayload } from '../types/image';

interface ImageCardProps {
  item: ImageItem;
  fallbackAuthorLogin?: string;
  roleLabel?: string;
  editable: boolean;
  busy: boolean;
  onDelete: (id: string) => Promise<void>;
  onSave: (payload: UpdateImagePayload) => Promise<void>;
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

function ImageGrid({ urls, alt }: { urls: string[]; alt: string }) {
  if (urls.length === 0) return null;

  if (urls.length === 1) {
    return (
      <div className="overflow-hidden bg-slate-950/20 pr-12">
        <img alt={alt} className="w-full object-contain" src={urls[0]} />
      </div>
    );
  }

  // 2-9 images: square grid, 3 columns max
  const cols = urls.length <= 2 ? 2 : 3;
  return (
    <div className={`grid gap-0.5 ${cols === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {urls.map((url, i) => (
        <div className="relative aspect-square overflow-hidden bg-slate-950/20" key={i}>
          <img alt={`${alt} ${i + 1}`} className="absolute inset-0 h-full w-full object-cover" src={url} />
        </div>
      ))}
    </div>
  );
}

export function ImageCard({ busy, editable, fallbackAuthorLogin, item, onDelete, onSave, roleLabel }: ImageCardProps) {
  const descriptionId = useId();
  const timeId = useId();
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(item.description);
  const [capturedAt, setCapturedAt] = useState(toDateTimeInputValue(item.capturedAt));
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      await onSave({
        id: item.id,
        description: description.trim(),
        capturedAt: `${capturedAt}:00+08:00`,
        files: files.length > 0 ? files : undefined,
      });
      setEditing(false);
      setFiles([]);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败');
    }
  };

  const reset = () => {
    setDescription(item.description);
    setCapturedAt(toDateTimeInputValue(item.capturedAt));
    setFiles([]);
    setError(null);
    setEditing(false);
  };

  const iconButtonClass =
    'inline-flex h-8 w-8 items-center justify-center text-soft transition hover:text-[var(--text-main)]';

  const authorLogin = item.authorLogin || fallbackAuthorLogin || 'GitHub';
  const authorLabel = authorLogin;
  const authorAvatar = item.authorAvatar || (authorLogin !== 'GitHub' ? `https://github.com/${authorLogin}.png?size=64` : '');

  const imageUrls = item.imageUrls ?? [];

  return (
    <article className="glass-panel group overflow-hidden rounded-[2.2rem]" id={`story-${item.id}`}>
      {editing ? (
        <div className="space-y-4 p-5 md:p-6">
          <label className="block space-y-2" htmlFor={descriptionId}>
            <span className="text-sm text-soft">说明</span>
            <textarea
              className="min-h-24 w-full rounded-[1.6rem] border border-white/10 bg-slate-950/20 px-4 py-3 outline-none transition focus:border-cyan-400/70"
              id={descriptionId}
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
          </label>

          <label className="block space-y-2" htmlFor={timeId}>
            <span className="text-sm text-soft">北京时间</span>
            <input
              className="w-full rounded-full border border-white/10 bg-slate-950/20 px-4 py-3 outline-none transition focus:border-cyan-400/70"
              id={timeId}
              onChange={(event) => setCapturedAt(event.target.value)}
              type="datetime-local"
              value={capturedAt}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-soft">替换图片（多选）</span>
            <input accept="image/*" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} type="file" />
          </label>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 p-5 pb-0 md:px-6 md:pt-6">
            {authorAvatar ? (
              <img alt={authorLabel} className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10" src={authorAvatar} />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/8 text-sm font-semibold text-soft ring-1 ring-white/10">
                {authorLabel.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-[var(--text-main)]">
                {authorLabel}
                {roleLabel ? <span className="rounded-full bg-white/8 px-2 py-0.5 text-xs text-soft">{roleLabel}</span> : null}
              </p>
            </div>
          </div>
          {item.description.trim() ? (
            <p className="whitespace-pre-wrap px-5 pt-4 font-serif text-2xl leading-relaxed text-[var(--text-main)] md:px-6 md:text-[2rem]">
              {item.description}
            </p>
          ) : null}
          {imageUrls.length > 0 ? (
            <div className="mt-4">
              <ImageGrid alt={item.description} urls={imageUrls} />
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-4 p-5 pt-4 md:px-6 md:pb-6">
            <p className="text-sm text-soft">{toBeijingText(item.capturedAt)}</p>
            {editable ? (
              <div className="flex items-center gap-3 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                <button aria-label="修改卡片" className={iconButtonClass} onClick={() => setEditing(true)} type="button">
                  <PencilLine size={19} />
                </button>
                <button aria-label="删除卡片" className={`${iconButtonClass} text-rose-300 hover:text-rose-200`} onClick={() => void onDelete(item.id)} type="button">
                  <Trash2 size={19} />
                </button>
              </div>
            ) : null}
          </div>
        </>
      )}

      {editable && editing ? (
        <div className="flex items-center justify-end gap-3 p-5 pt-0 md:px-6 md:pb-6">
          <button aria-label="保存修改" className={iconButtonClass} onClick={() => void handleSave()} type="button">
            <Save size={19} />
          </button>
          <button aria-label="取消修改" className={iconButtonClass} onClick={reset} type="button">
            <X size={19} />
          </button>
        </div>
      ) : null}

      {busy && editing ? <p className="px-5 pb-5 text-xs text-soft md:px-6 md:pb-6">正在提交修改…</p> : null}
    </article>
  );
}