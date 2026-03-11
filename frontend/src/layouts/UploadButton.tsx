import { useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { PostDialog } from '../ui/PostDialog';
import type { CreateImagePayload } from '../types/image';

interface UploadButtonProps {
  busy: boolean;
  onSubmit: (payload: CreateImagePayload) => Promise<void>;
}

export function UploadButton({ busy, onSubmit }: UploadButtonProps) {
  const [open, setOpen] = useState(false);

  const handleSubmit = async (data: { description: string; tags: string[]; timeMode: 'point' | 'range'; startAt: string; endAt?: string; files: File[] }) => {
    await onSubmit({
      description: data.description,
      tags: data.tags,
      timeMode: data.timeMode,
      startAt: data.startAt,
      endAt: data.endAt,
      files: data.files,
    });
    setOpen(false);
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

      <PostDialog
        busy={busy}
        mode="create"
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
        open={open}
      />
    </>
  );
}
