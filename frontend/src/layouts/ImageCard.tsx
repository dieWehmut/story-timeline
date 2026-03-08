import { useId, useMemo, useState } from 'react';
import { Clock3, PencilLine, Save, Trash2, X } from 'lucide-react';
import { Button } from '../ui/Button';
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

  const monthKey = useMemo(() => capturedAt.slice(0, 7), [capturedAt]);

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

  return (
    <article className="glass-panel group rounded-[2.2rem] p-5 md:p-6" data-month-key={monthKey} id={`story-${item.id}`}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-cyan-300/75">Story Card</p>
          <p className="mt-2 text-sm text-soft">北京时间 · {monthKey.replace('-', ' / ')}</p>
        </div>
        {editable ? (
          <div className="flex items-center gap-2 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
            {editing ? (
              <>
                <Button className="h-10 w-10 rounded-2xl p-0" onClick={() => void handleSave()} variant="primary">
                  <Save size={16} />
                </Button>
                <Button className="h-10 w-10 rounded-2xl p-0" onClick={reset} variant="ghost">
                  <X size={16} />
                </Button>
              </>
            ) : (
              <>
                <Button className="h-10 w-10 rounded-2xl p-0" onClick={() => setEditing(true)} variant="ghost">
                  <PencilLine size={16} />
                </Button>
                <Button className="h-10 w-10 rounded-2xl p-0 text-rose-200 hover:bg-rose-500/10" onClick={() => void onDelete(item.id)} variant="ghost">
                  <Trash2 size={16} />
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>

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
          <div className="mt-5 flex items-center gap-2 text-sm text-soft">
            <Clock3 size={16} />
            <span>{toBeijingText(item.capturedAt)}</span>
          </div>
        </>
      )}

      {busy && editing ? <p className="mt-3 text-xs text-soft">正在提交修改…</p> : null}
    </article>
  );
}