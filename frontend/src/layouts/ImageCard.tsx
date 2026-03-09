import { useId, useState } from 'react';
import { PencilLine, Save, Trash2, X } from 'lucide-react';
import type { ImageItem, UpdateImagePayload } from '../types/image';

interface ImageCardProps {
  item: ImageItem;
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

export function ImageCard({ busy, editable, item, onDelete, onSave }: ImageCardProps) {
  const descriptionId = useId();
  const timeId = useId();
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(item.description);
  const [capturedAt, setCapturedAt] = useState(toDateTimeInputValue(item.capturedAt));
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      await onSave({
        id: item.id,
        description: description.trim(),
        capturedAt: `${capturedAt}:00+08:00`,
        file,
      });
      setEditing(false);
      setFile(null);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败');
    }
  };

  const reset = () => {
    setDescription(item.description);
    setCapturedAt(toDateTimeInputValue(item.capturedAt));
    setFile(null);
    setError(null);
    setEditing(false);
  };

  const iconButtonClass =
    'inline-flex h-8 w-8 items-center justify-center text-soft transition hover:text-[var(--text-main)]';

  return (
    <article className="glass-panel group rounded-[2.2rem] p-5 md:p-6" id={`story-${item.id}`}>
      {editing ? (
        <div className="space-y-4">
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
            <span className="text-sm text-soft">替换图片</span>
            <input accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} type="file" />
          </label>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </div>
      ) : (
        <>
          <p className="mb-5 whitespace-pre-wrap font-serif text-2xl leading-relaxed text-[var(--text-main)] md:text-[2rem]">
            {item.description}
          </p>
          <div className="overflow-hidden rounded-[1.8rem] bg-slate-950/20">
            <img alt={item.description} className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-[1.015]" src={item.imageUrl} />
          </div>
          <div className="mt-5 flex items-center justify-between gap-4">
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
        <div className="mt-5 flex items-center justify-end gap-3">
          <button aria-label="保存修改" className={iconButtonClass} onClick={() => void handleSave()} type="button">
            <Save size={19} />
          </button>
          <button aria-label="取消修改" className={iconButtonClass} onClick={reset} type="button">
            <X size={19} />
          </button>
        </div>
      ) : null}

      {busy && editing ? <p className="mt-3 text-xs text-soft">正在提交修改…</p> : null}
    </article>
  );
}