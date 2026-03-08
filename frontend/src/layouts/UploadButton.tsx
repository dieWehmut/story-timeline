import { useId, useState } from 'react';
import { ImagePlus, UploadCloud, X } from 'lucide-react';
import { Button } from '../ui/Button';
import type { CreateImagePayload } from '../types/image';

interface UploadButtonProps {
  busy: boolean;
  onSubmit: (payload: CreateImagePayload) => Promise<void>;
}

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

const toBeijingIso = (value: string) => `${value}:00+08:00`;

export function UploadButton({ busy, onSubmit }: UploadButtonProps) {
  const descriptionId = useId();
  const timeId = useId();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [capturedAt, setCapturedAt] = useState(getDefaultDateTime());
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setDescription('');
    setCapturedAt(getDefaultDateTime());
    setFile(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!description.trim() || !file || !capturedAt) {
      setError('请填写说明、时间并选择图片');
      return;
    }

    try {
      await onSubmit({
        description: description.trim(),
        capturedAt: toBeijingIso(capturedAt),
        file,
      });
      reset();
      setOpen(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '上传失败');
    }
  };

  return (
    <>
      <Button block className="rounded-2xl bg-[var(--button-bg)] px-4 py-3" onClick={() => setOpen(true)} variant="secondary">
        <ImagePlus size={16} />
        上传
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 px-4">
          <div className="glass-panel w-full max-w-lg rounded-[2rem] p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-cyan-300/80">Create Story</p>
                <h2 className="mt-2 font-serif text-2xl font-semibold">上传新的时间卡片</h2>
              </div>
              <Button aria-label="关闭上传面板" className="h-10 w-10 rounded-2xl p-0" onClick={() => setOpen(false)} variant="ghost">
                <X size={16} />
              </Button>
            </div>

            <div className="space-y-4">
              <label className="block space-y-2" htmlFor={descriptionId}>
                <span className="text-sm text-soft">说明</span>
                <textarea
                  className="min-h-28 w-full rounded-3xl border border-white/10 bg-slate-950/30 px-4 py-3 outline-none transition focus:border-cyan-400/70"
                  id={descriptionId}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="写下这张图片对应的瞬间。"
                  value={description}
                />
              </label>

              <label className="block space-y-2" htmlFor={timeId}>
                <span className="text-sm text-soft">北京时间</span>
                <input
                  className="w-full rounded-full border border-white/10 bg-slate-950/30 px-4 py-3 outline-none transition focus:border-cyan-400/70"
                  id={timeId}
                  onChange={(event) => setCapturedAt(event.target.value)}
                  type="datetime-local"
                  value={capturedAt}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-soft">图片</span>
                <div className="rounded-[1.75rem] border border-dashed border-white/15 bg-slate-950/20 p-4">
                  <input accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} type="file" />
                  <p className="mt-3 text-xs text-soft">浏览器会先转换成 WebP，再上传到 story-images。</p>
                </div>
              </label>

              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button className="rounded-full px-5 py-3" onClick={() => { reset(); setOpen(false); }} variant="ghost">
                取消
              </Button>
              <Button className="rounded-full px-5 py-3" disabled={busy} onClick={() => void handleSubmit()}>
                <UploadCloud size={16} />
                {busy ? '提交中' : '上传并提交'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}