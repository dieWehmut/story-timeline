import { useId, useState } from 'react';
import { ImagePlus, UploadCloud, X } from 'lucide-react';
import { Button } from '../ui/Button';
import type { CreateImagePayload } from '../types/image';

interface UploadButtonProps {
  busy: boolean;
  onSubmit: (payload: CreateImagePayload) => Promise<void>;
}

const MAX_FILES = 9;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25 MB

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
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setDescription('');
    setCapturedAt(getDefaultDateTime());
    setFiles([]);
    setError(null);
  };

  const handleFilesChange = (incoming: FileList | null) => {
    if (!incoming) return;
    const next = [...files, ...Array.from(incoming)].slice(0, MAX_FILES);

    let totalSize = 0;
    for (const f of next) {
      if (f.size > MAX_FILE_SIZE) {
        setError(`单张图片不能超过 5MB: ${f.name}`);
        return;
      }
      totalSize += f.size;
    }
    if (totalSize > MAX_TOTAL_SIZE) {
      setError('帖子总大小不能超过 25MB');
      return;
    }

    setError(null);
    setFiles(next);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!capturedAt) {
      setError('请填写时间');
      return;
    }
    if (!description.trim() && files.length === 0) {
      setError('请输入文字或选择图片');
      return;
    }

    try {
      await onSubmit({
        description: description.trim(),
        capturedAt: toBeijingIso(capturedAt),
        files,
      });
      reset();
      setOpen(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '上传失败');
    }
  };

  return (
    <>
      <button
        aria-label="上传图片"
        className="inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95"
        onClick={() => setOpen(true)}
        type="button"
      >
        <ImagePlus size={24} />
      </button>

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
                <span className="text-sm text-soft">说明（可选）</span>
                <textarea
                  className="min-h-28 w-full rounded-3xl border border-white/10 bg-slate-950/30 px-4 py-3 outline-none transition focus:border-cyan-400/70"
                  id={descriptionId}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="可以留空，或者写下这张图片对应的瞬间。"
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

              <div className="space-y-2">
                <span className="text-sm text-soft">图片（可选，最多 {MAX_FILES} 张）</span>
                <div className="rounded-[1.75rem] border border-dashed border-white/15 bg-slate-950/20 p-4">
                  <input
                    accept="image/*"
                    disabled={files.length >= MAX_FILES}
                    multiple
                    onChange={(event) => { handleFilesChange(event.target.files); event.target.value = ''; }}
                    type="file"
                  />
                  <p className="mt-3 text-xs text-soft">单张 ≤ 5MB · 总计 ≤ 25MB · 浏览器会先转成 WebP</p>
                </div>
                {files.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {files.map((f, i) => (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/8 px-2 py-1 text-xs text-soft" key={`${f.name}-${i}`}>
                        {f.name.length > 16 ? `${f.name.slice(0, 14)}…` : f.name}
                        <button className="ml-0.5 hover:text-rose-300" onClick={() => removeFile(i)} type="button"><X size={12} /></button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

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