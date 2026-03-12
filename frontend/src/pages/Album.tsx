import { useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon, Layers, Video } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlbumHeader } from '../layouts/AlbumHeader';
import { useImages } from '../hooks/useImages';
import type { ImageItem } from '../types/image';

interface AlbumProps {
  images: ReturnType<typeof useImages>;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
}

type TabKey = 'albums' | 'photos' | 'videos';

const dateFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const toDateKey = (value: string) => dateFormatter.format(new Date(value));

const normalizeTag = (value: string) => value.trim().toLowerCase();

const isVideoUrl = (url: string) => {
  const clean = url.split('?')[0].toLowerCase();
  return (
    clean.endsWith('.mp4') ||
    clean.endsWith('.mov') ||
    clean.endsWith('.webm') ||
    clean.endsWith('.m4v') ||
    clean.endsWith('.avi') ||
    clean.endsWith('.mkv')
  );
};

type MediaEntry = {
  id: string;
  url: string;
  type: 'photo' | 'video';
  dateKey: string;
  timestamp: number;
  tags: string[];
  description: string;
};

type MediaGroup = {
  date: string;
  items: MediaEntry[];
};

type AlbumCard = {
  tag: string;
  count: number;
  coverUrl?: string;
  latestAt: number;
};

function AlbumCardItem({ card, onClick }: { card: AlbumCard; onClick: () => void }) {
  return (
    <button
      className="group flex w-full flex-col overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] text-left shadow-[var(--panel-shadow)] transition hover:-translate-y-0.5 hover:border-[var(--text-accent)]"
      onClick={onClick}
      type="button"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-950/20">
        {card.coverUrl ? (
          <img
            alt={card.tag}
            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
            src={card.coverUrl}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-soft">
            暂无封面
          </div>
        )}
        <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
          {card.count} 张
        </span>
      </div>
      <div className="px-3 py-2">
        <p className="text-sm font-medium text-[var(--text-main)]">{card.tag}</p>
      </div>
    </button>
  );
}

function MediaTimeline({ groups, emptyLabel }: { groups: MediaGroup[]; emptyLabel: string }) {
  if (groups.length === 0) {
    return <p className="py-12 text-center text-sm text-soft">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.date}>
          <p className="mb-2 text-sm font-medium text-[var(--text-main)]">{group.date}</p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {group.items.map((entry) => (
              <div className="relative aspect-square overflow-hidden rounded-lg bg-slate-950/20" key={entry.id}>
                {entry.type === 'video' ? (
                  <video className="absolute inset-0 h-full w-full object-cover" controls preload="metadata" src={entry.url} />
                ) : (
                  <img
                    alt={entry.description}
                    className="absolute inset-0 h-full w-full object-cover"
                    src={entry.url}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const buildMediaEntries = (items: ImageItem[]) => {
  const albumMap = new Map<string, AlbumCard>();
  const photoEntries: MediaEntry[] = [];
  const videoEntries: MediaEntry[] = [];

  items.forEach((item) => {
    const timestamp = new Date(item.startAt).getTime();
    const dateKey = toDateKey(item.startAt);
    const tagKeys = (item.tags ?? []).map(normalizeTag).filter(Boolean);
    const urls = item.imageUrls ?? [];

    urls.forEach((url, index) => {
      const type = isVideoUrl(url) ? 'video' : 'photo';
      const entry: MediaEntry = {
        id: `${item.id}-${index}`,
        url,
        type,
        dateKey,
        timestamp,
        tags: tagKeys,
        description: item.description,
      };
      if (type === 'video') {
        videoEntries.push(entry);
      } else {
        photoEntries.push(entry);
      }
    });

    const photoUrls = urls.filter((url) => !isVideoUrl(url));
    (item.tags ?? []).forEach((tag) => {
      const key = normalizeTag(tag);
      if (!key) return;
      const existing = albumMap.get(key) ?? { tag, count: 0, coverUrl: undefined, latestAt: 0 };
      existing.count += photoUrls.length;
      if (photoUrls.length > 0 && timestamp >= existing.latestAt) {
        existing.coverUrl = photoUrls[0];
        existing.latestAt = timestamp;
        existing.tag = tag;
      }
      albumMap.set(key, existing);
    });
  });

  const albumCards = [...albumMap.values()].sort((left, right) =>
    left.tag.localeCompare(right.tag, 'zh-Hans-CN')
  );

  return {
    albumCards,
    photoEntries,
    videoEntries,
  };
};

const groupByDate = (entries: MediaEntry[], order: 'asc' | 'desc') => {
  const map = new Map<string, MediaEntry[]>();
  entries.forEach((entry) => {
    if (!map.has(entry.dateKey)) {
      map.set(entry.dateKey, []);
    }
    map.get(entry.dateKey)!.push(entry);
  });

  const groups: MediaGroup[] = [...map.entries()].map(([date, items]) => ({
    date,
    items: items.sort((a, b) => (order === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp)),
  }));

  return groups.sort((a, b) =>
    order === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
  );
};

export default function Album({ images, theme, onThemeToggle }: AlbumProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('albums');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const tagParam = searchParams.get('tag');
  const activeTagKey = tagParam ? normalizeTag(tagParam) : null;

  useEffect(() => {
    if (activeTagKey) {
      setActiveTab('albums');
    }
  }, [activeTagKey]);

  const { albumCards, photoEntries, videoEntries } = useMemo(
    () => buildMediaEntries(images.allItems),
    [images.allItems]
  );

  const albumCount = albumCards.length;
  const photoCount = photoEntries.length;
  const videoCount = videoEntries.length;

  const activeAlbum = activeTagKey
    ? albumCards.find((card) => normalizeTag(card.tag) === activeTagKey)
    : null;
  const activeAlbumTitle = activeAlbum?.tag ?? tagParam ?? '相册';

  const filteredAlbumPhotos = activeTagKey
    ? photoEntries.filter((entry) => entry.tags.includes(activeTagKey))
    : [];

  const albumGroups = useMemo(
    () => groupByDate(filteredAlbumPhotos, images.timeOrder),
    [filteredAlbumPhotos, images.timeOrder]
  );
  const photoGroups = useMemo(
    () => groupByDate(photoEntries, images.timeOrder),
    [photoEntries, images.timeOrder]
  );
  const videoGroups = useMemo(
    () => groupByDate(videoEntries, images.timeOrder),
    [videoEntries, images.timeOrder]
  );

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    if (tab !== 'albums' && activeTagKey) {
      setSearchParams({});
    }
  };

  const handleAlbumClick = (tag: string) => {
    const params = new URLSearchParams();
    params.set('tag', tag);
    setSearchParams(params);
    setActiveTab('albums');
  };

  const headerTitle =
    activeTab === 'albums'
      ? activeTagKey
        ? activeAlbumTitle
        : '相册'
      : activeTab === 'photos'
        ? '照片'
        : '视频';

  const headerSubtitle =
    activeTab === 'albums'
      ? activeTagKey
        ? undefined
        : `${albumCount} 相册 ${photoCount} 照片 ${videoCount} 视频`
      : activeTab === 'photos'
        ? `${photoCount} 照片`
        : `${videoCount} 视频`;

  return (
    <div className="min-h-screen pb-24">
      <AlbumHeader
        onBack={() => navigate(-1)}
        onThemeToggle={onThemeToggle}
        onToggleSort={images.toggleTimeOrder}
        showSort={activeTab !== 'albums' || !!activeTagKey}
        sortOrder={images.timeOrder}
        subtitle={headerSubtitle}
        theme={theme}
        title={headerTitle}
      />

      <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-24">
        {images.loading ? (
          <p className="py-12 text-center text-sm text-soft">加载中...</p>
        ) : activeTab === 'albums' && !activeTagKey ? (
          albumCards.length === 0 ? (
            <p className="py-12 text-center text-sm text-soft">暂无相册</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {albumCards.map((card) => (
                <AlbumCardItem
                  card={card}
                  key={card.tag}
                  onClick={() => handleAlbumClick(card.tag)}
                />
              ))}
            </div>
          )
        ) : activeTab === 'albums' && activeTagKey ? (
          <MediaTimeline groups={albumGroups} emptyLabel="该相册暂无照片" />
        ) : activeTab === 'photos' ? (
          <MediaTimeline groups={photoGroups} emptyLabel="暂无照片" />
        ) : (
          <MediaTimeline groups={videoGroups} emptyLabel="暂无视频" />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-md items-center justify-between">
          <button
            className={`flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm transition ${
              activeTab === 'albums'
                ? 'bg-cyan-500/20 text-cyan-200'
                : 'text-soft hover:text-[var(--text-main)]'
            }`}
            onClick={() => handleTabChange('albums')}
            type="button"
          >
            <Layers size={16} />
            相册
          </button>
          <button
            className={`flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm transition ${
              activeTab === 'photos'
                ? 'bg-cyan-500/20 text-cyan-200'
                : 'text-soft hover:text-[var(--text-main)]'
            }`}
            onClick={() => handleTabChange('photos')}
            type="button"
          >
            <ImageIcon size={16} />
            照片
          </button>
          <button
            className={`flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm transition ${
              activeTab === 'videos'
                ? 'bg-cyan-500/20 text-cyan-200'
                : 'text-soft hover:text-[var(--text-main)]'
            }`}
            onClick={() => handleTabChange('videos')}
            type="button"
          >
            <Video size={16} />
            视频
          </button>
        </div>
      </nav>
    </div>
  );
}
