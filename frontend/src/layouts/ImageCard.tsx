import { useState } from 'react';
import { PencilLine, Trash2 } from 'lucide-react';
import { ImageViewer } from '../ui/ImageViewer';
import { PostDialog } from '../ui/PostDialog';
import { useToast } from '../ui/useToast';
import type { ImageItem, UpdateImagePayload } from '../types/image';

interface ImageCardProps {
  item: ImageItem;
  fallbackAuthorLogin?: string;
  roleLabel?: string;
  editable: boolean;
  busy: boolean;
  onAvatarClick?: (login: string) => void;
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

function ImageGrid({ urls, alt, onImageClick }: { urls: string[]; alt: string; onImageClick: (index: number) => void }) {
  if (urls.length === 0) return null;

  if (urls.length === 1) {
    return (
      <div className="cursor-pointer overflow-hidden bg-slate-950/20" onClick={() => onImageClick(0)}>
        <img alt={alt} className="w-full object-contain" src={urls[0]} />
      </div>
    );
  }

  const cols = urls.length <= 2 ? 2 : 3;
  return (
    <div className={`grid gap-0.5 ${cols === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {urls.map((url, i) => (
        <div className="relative aspect-square cursor-pointer overflow-hidden bg-slate-950/20" key={i} onClick={() => onImageClick(i)}>
          <img alt={`${alt} ${i + 1}`} className="absolute inset-0 h-full w-full object-cover" src={url} />
        </div>
      ))}
    </div>
  );
}

export function ImageCard({ busy, editable, fallbackAuthorLogin, item, onAvatarClick, onDelete, onSave, roleLabel }: ImageCardProps) {
  const [editing, setEditing] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const { confirm } = useToast();

  const iconButtonClass =
    'inline-flex h-8 w-8 items-center justify-center text-soft transition hover:text-[var(--text-main)]';

  const authorLogin = item.authorLogin || fallbackAuthorLogin || 'GitHub';
  const authorLabel = authorLogin;
  const authorAvatar = item.authorAvatar || (authorLogin !== 'GitHub' ? `https://github.com/${authorLogin}.png?size=64` : '');

  const imageUrls = item.imageUrls ?? [];

  const handleEditSubmit = async (data: { description: string; capturedAt: string; files: File[] }) => {
    await onSave({
      id: item.id,
      description: data.description,
      capturedAt: data.capturedAt,
      files: data.files.length > 0 ? data.files : undefined,
    });
    setEditing(false);
  };

  const handleDelete = () => {
    confirm('确定要删除这张卡片吗？', () => {
      void onDelete(item.id);
    });
  };

  return (
    <>
      <article className="group overflow-hidden" id={`story-${item.id}`}>
        {/* Author row */}
        <div className="flex items-center gap-2 px-2 pb-0 pt-3">
          {authorAvatar ? (
            <button
              className="shrink-0 transition-transform hover:scale-110"
              onClick={() => onAvatarClick?.(authorLogin)}
              title={authorLabel}
              type="button"
            >
              <img alt={authorLabel} className="h-8 w-8 rounded-full object-cover ring-1 ring-white/10" src={authorAvatar} />
            </button>
          ) : (
            <button
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-xs font-semibold text-soft ring-1 ring-white/10 transition-transform hover:scale-110"
              onClick={() => onAvatarClick?.(authorLogin)}
              title={authorLabel}
              type="button"
            >
              {authorLabel.slice(0, 1).toUpperCase()}
            </button>
          )}
          <p className="flex items-center gap-2 text-sm font-medium text-[var(--text-main)]">
            {authorLabel}
            {roleLabel ? <span className="rounded-full bg-white/8 px-2 py-0.5 text-xs text-soft">{roleLabel}</span> : null}
          </p>
        </div>
        {/* Description */}
        {item.description.trim() ? (
          <p className="whitespace-pre-wrap px-2 pt-2 font-serif text-xl leading-relaxed text-[var(--text-main)] md:text-2xl">
            {item.description}
          </p>
        ) : null}
        {/* Images */}
        {imageUrls.length > 0 ? (
          <div className="mt-2 px-2">
            <ImageGrid alt={item.description} onImageClick={setViewerIndex} urls={imageUrls} />
          </div>
        ) : null}
        {/* Footer */}
        <div className="flex items-center justify-between gap-4 px-2 pb-3 pt-2">
          <p className="text-xs text-soft">{toBeijingText(item.capturedAt)}</p>
          {editable ? (
            <div className="flex items-center gap-3 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
              <button aria-label="修改卡片" className={iconButtonClass} onClick={() => setEditing(true)} type="button">
                <PencilLine size={17} />
              </button>
              <button aria-label="删除卡片" className={`${iconButtonClass} text-rose-300 hover:text-rose-200`} onClick={handleDelete} type="button">
                <Trash2 size={17} />
              </button>
            </div>
          ) : null}
        </div>
      </article>

      {/* Image viewer lightbox */}
      {viewerIndex !== null ? (
        <ImageViewer initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} urls={imageUrls} />
      ) : null}

      {/* Edit dialog */}
      <PostDialog
        busy={busy}
        initialCapturedAt={toDateTimeInputValue(item.capturedAt)}
        initialDescription={item.description}
        initialImageUrls={imageUrls}
        mode="edit"
        onClose={() => setEditing(false)}
        onSubmit={handleEditSubmit}
        open={editing}
      />
    </>
  );
}