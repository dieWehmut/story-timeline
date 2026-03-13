import { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PostDialog } from '../ui/PostDialog';
import { useAuth } from '../hooks/useAuth';
import { useImages } from '../hooks/useImages';
import type { AssetOrderItem } from '../types/image';

interface PostProps {
  auth: ReturnType<typeof useAuth>;
  images: ReturnType<typeof useImages>;
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

export default function Post({ auth, images }: PostProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const id = searchParams.get('id');
  const mode: 'create' | 'edit' = id ? 'edit' : 'create';

  const item = useMemo(
    () => (id ? images.allItems.find((entry) => entry.id === id) ?? null : null),
    [id, images.allItems]
  );

  const tagSuggestions = useMemo(() => {
    if (!auth.user) return [];
    const counts = new Map<string, { tag: string; count: number }>();
    images.allItems.forEach((entry) => {
      if (entry.authorLogin.toLowerCase() !== auth.user!.login.toLowerCase()) return;
      (entry.tags ?? []).forEach((tag) => {
        const normalized = tag.trim();
        if (!normalized) return;
        const key = normalized.toLowerCase();
        const existing = counts.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(key, { tag: normalized, count: 1 });
        }
      });
    });
    return [...counts.values()]
      .sort((left, right) => {
        if (right.count !== left.count) return right.count - left.count;
        return left.tag.localeCompare(right.tag, 'zh-Hans-CN');
      })
      .map((entry) => entry.tag);
  }, [auth.user, images.allItems]);

  const handleClose = () => {
    const fallback = (location.state as { from?: string } | null)?.from ?? '/story';
    navigate(fallback, { replace: true });
  };

  const handleSubmit = async (data: {
    description: string;
    tags: string[];
    timeMode: 'point' | 'range';
    startAt: string;
    endAt?: string;
    files: File[];
    removedUrls?: string[];
    assetOrder: AssetOrderItem[];
  }) => {
    if (mode === 'edit' && item) {
      const assetPathMap: Record<string, string> = {};
      const imagePaths = item.imagePaths ?? [];
      item.imageUrls.forEach((url, index) => {
        const path = imagePaths[index];
        if (path) {
          assetPathMap[url] = path;
        }
      });
      await images.updateImage({
        id: item.id,
        description: data.description,
        tags: data.tags,
        timeMode: data.timeMode,
        startAt: data.startAt,
        endAt: data.endAt,
        files: data.files.length > 0 ? data.files : undefined,
        assetOrder: data.assetOrder,
        assetPathMap,
      });
    } else if (mode === 'create') {
      await images.createImage(
        {
          description: data.description,
          tags: data.tags,
          timeMode: data.timeMode,
          startAt: data.startAt,
          endAt: data.endAt,
          files: data.files,
        },
        auth.user ? { login: auth.user.login, avatarUrl: auth.user.avatarUrl } : undefined
      );
    }

    handleClose();
  };

  if (mode === 'edit' && !item && !images.loading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-soft">找不到对应的帖子。</p>
        <button
          className="rounded-full border border-[var(--panel-border)] px-4 py-2 text-sm text-[var(--text-main)] transition hover:border-[var(--text-accent)] hover:text-[var(--text-accent)]"
          onClick={handleClose}
          type="button"
        >
          返回
        </button>
      </div>
    );
  }

  if (mode === 'edit' && !item && images.loading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-6 text-sm text-soft">
        加载中...
      </div>
    );
  }

  return (
    <PostDialog
      busy={images.submitting}
      closeOnSubmit={false}
      initialDescription={item?.description ?? ''}
      initialEndAt={item?.endAt ? toDateTimeInputValue(item.endAt) : undefined}
      initialAssetTypes={item?.assetTypes ?? []}
      initialImageUrls={item?.imageUrls ?? []}
      initialStartAt={item?.startAt ? toDateTimeInputValue(item.startAt) : undefined}
      initialTags={item?.tags ?? []}
      initialTimeMode={item?.timeMode ?? 'point'}
      mode={mode}
      onClose={handleClose}
      onSubmit={handleSubmit}
      open
      tagSuggestions={tagSuggestions}
      variant="page"
    />
  );
}
