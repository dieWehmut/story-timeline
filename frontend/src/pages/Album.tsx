import { useEffect, useMemo, useRef, useState } from 'react';
import { Image as ImageIcon, Layers, Video } from 'lucide-react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AlbumHeader } from '../layouts/AlbumHeader';
import { TimeColumn } from '../layouts/TimeColumn';
import { useAuth } from '../hooks/useAuth';
import { useImages } from '../hooks/useImages';
import { ImageViewer } from '../ui/ImageViewer';
import { normalizeAssetTypes } from '../lib/media';
import type { MediaItem } from '../lib/media';
import type { ImageItem, TimelineMonth } from '../types/image';

interface AlbumProps {
  auth: ReturnType<typeof useAuth>;
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

function MediaTimeline({
  groups,
  emptyLabel,
  onSectionRef,
  onPhotoClick,
}: {
  groups: MediaGroup[];
  emptyLabel: string;
  onSectionRef?: (monthKey: string, node: HTMLElement | null) => void;
  onPhotoClick?: (entryId: string) => void;
}) {
  if (groups.length === 0) {
    return <p className="py-12 text-center text-sm text-soft">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const monthKey = group.date.slice(0, 7);
        return (
          <section
            data-month-key={monthKey}
            key={group.date}
            ref={(node) => onSectionRef?.(monthKey, node)}
          >
          <p className="mb-2 text-sm font-medium text-[var(--text-main)]">{group.date}</p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {group.items.map((entry) => (
              <div
                className={`relative aspect-square overflow-hidden rounded-lg bg-slate-950/20 ${
                  entry.type === 'photo' && onPhotoClick ? 'cursor-pointer' : ''
                }`}
                key={entry.id}
                onClick={() => {
                  if (entry.type === 'photo') {
                    onPhotoClick?.(entry.id);
                  }
                }}
                role={entry.type === 'photo' && onPhotoClick ? 'button' : undefined}
                tabIndex={entry.type === 'photo' && onPhotoClick ? 0 : undefined}
              >
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
        );
      })}
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
    const types = normalizeAssetTypes(urls, item.assetTypes);

    urls.forEach((url, index) => {
      const type = types[index] === 'video' ? 'video' : 'photo';
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

    const photoUrls = urls.filter((_, index) => types[index] !== 'video');
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

const buildTimelineMonths = (entries: MediaEntry[], order: 'asc' | 'desc'): TimelineMonth[] => {
  const monthMap = new Map<string, TimelineMonth>();
  entries.forEach((entry) => {
    const [yearText, monthText] = entry.dateKey.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const key = `${yearText}-${monthText}`;
    const existing = monthMap.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }
    monthMap.set(key, {
      key,
      year,
      month,
      label: `${year}年${month}月`,
      count: 1,
    });
  });
  return [...monthMap.values()].sort((left, right) =>
    order === 'asc' ? left.key.localeCompare(right.key) : right.key.localeCompare(left.key)
  );
};

export default function Album({ auth, images, theme, onThemeToggle }: AlbumProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('albums');
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [activeMonth, setActiveMonth] = useState<TimelineMonth | null>(null);
  const [viewer, setViewer] = useState<{ items: MediaItem[]; index: number } | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const userParam = searchParams.get('user');
  const tagParam = searchParams.get('tag');
  const activeUser = userParam && userParam.trim() ? userParam.trim() : null;
  const activeTagKey = tagParam ? normalizeTag(tagParam) : null;

  if (!auth.loading && !auth.authenticated) {
    return <Navigate replace to="/" />;
  }

  useEffect(() => {
    if (activeTagKey) {
      setActiveTab('albums');
    }
  }, [activeTagKey]);

  useEffect(() => {
    sectionRefs.current = {};
    setActiveMonth(null);
    setTimelineOpen(false);
  }, [activeTab, activeTagKey, activeUser]);

  const scopedItems = useMemo(() => {
    if (!activeUser) return images.allItems;
    const normalized = activeUser.toLowerCase();
    return images.allItems.filter(
      (item) => item.authorLogin.toLowerCase() === normalized
    );
  }, [images.allItems, activeUser]);

  const { albumCards, photoEntries, videoEntries } = useMemo(
    () => buildMediaEntries(scopedItems),
    [scopedItems]
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

  const currentTimelineEntries =
    activeTab === 'albums'
      ? activeTagKey
        ? filteredAlbumPhotos
        : []
      : activeTab === 'photos'
        ? photoEntries
        : videoEntries;

  const timelineMonths = useMemo(
    () => buildTimelineMonths(currentTimelineEntries, images.timeOrder),
    [currentTimelineEntries, images.timeOrder]
  );

  useEffect(() => {
    if (!timelineMonths.length) {
      setActiveMonth(null);
      return;
    }
    if (!activeMonth || !timelineMonths.some((month) => month.key === activeMonth.key)) {
      setActiveMonth(timelineMonths[0]);
    }
  }, [activeMonth, timelineMonths]);

  useEffect(() => {
    const nodes = timelineMonths
      .map((month) => sectionRefs.current[month.key])
      .filter(Boolean) as HTMLElement[];

    if (!nodes.length) {
      return;
    }

    const syncActiveMonth = () => {
      const activationOffset = 140;
      const current =
        [...nodes]
          .reverse()
          .find((node) => node.getBoundingClientRect().top <= activationOffset) ?? nodes[0];
      const monthKey = current?.getAttribute('data-month-key');
      const month = timelineMonths.find((entry) => entry.key === monthKey);

      if (month && month.key !== activeMonth?.key) {
        setActiveMonth(month);
      }
    };

    syncActiveMonth();

    const handleScroll = () => {
      window.requestAnimationFrame(syncActiveMonth);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [activeMonth?.key, timelineMonths]);

  const registerSectionRef = (monthKey: string, node: HTMLElement | null) => {
    if (!node) return;
    if (!sectionRefs.current[monthKey]) {
      sectionRefs.current[monthKey] = node;
    }
  };

  const currentPhotoEntries =
    activeTab === 'albums'
      ? filteredAlbumPhotos
      : activeTab === 'photos'
        ? photoEntries
        : [];

  const viewerItems = useMemo(
    () => currentPhotoEntries.map((entry) => ({ url: entry.url, type: 'image' as const })),
    [currentPhotoEntries]
  );
  const viewerIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    currentPhotoEntries.forEach((entry, index) => {
      map.set(entry.id, index);
    });
    return map;
  }, [currentPhotoEntries]);

  const handlePhotoClick = (entryId: string) => {
    const index = viewerIndexMap.get(entryId);
    if (index === undefined) return;
    setViewer({ items: viewerItems, index });
  };

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    if (tab !== 'albums' && activeTagKey) {
      const params = new URLSearchParams();
      if (activeUser) {
        params.set('user', activeUser);
      }
      setSearchParams(params);
    }
  };

  const handleAlbumClick = (tag: string) => {
    const params = new URLSearchParams();
    if (activeUser) {
      params.set('user', activeUser);
    }
    params.set('tag', tag);
    setSearchParams(params);
    setActiveTab('albums');
  };

  const jumpToMonth = (month: TimelineMonth) => {
    const target = sectionRefs.current[month.key];
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveMonth(month);
    setTimelineOpen(false);
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

  const tabBaseClass = 'album-tab flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm transition';
  const tabActiveClass = 'album-tab-active bg-cyan-500/20 text-cyan-200';
  const tabInactiveClass = 'album-tab-inactive text-soft hover:text-[var(--text-main)]';

  return (
    <div className="min-h-screen pb-24">
      <AlbumHeader
        onBack={() => navigate(-1)}
        onThemeToggle={onThemeToggle}
        onTimelineToggle={() => setTimelineOpen((open) => !open)}
        showTimeline={activeTab !== 'albums' || !!activeTagKey}
        timelineOpen={timelineOpen}
        subtitle={headerSubtitle}
        theme={theme}
        title={headerTitle}
      />

      {timelineOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setTimelineOpen(false)} />
      )}

      <TimeColumn
        activeMonth={activeMonth}
        months={timelineMonths}
        onJump={jumpToMonth}
        onToggleOrder={images.toggleTimeOrder}
        open={timelineOpen}
        order={images.timeOrder}
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
          <MediaTimeline
            groups={albumGroups}
            emptyLabel="该相册暂无照片"
            onPhotoClick={handlePhotoClick}
            onSectionRef={registerSectionRef}
          />
        ) : activeTab === 'photos' ? (
          <MediaTimeline
            groups={photoGroups}
            emptyLabel="暂无照片"
            onPhotoClick={handlePhotoClick}
            onSectionRef={registerSectionRef}
          />
        ) : (
          <MediaTimeline groups={videoGroups} emptyLabel="暂无视频" onSectionRef={registerSectionRef} />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-md items-center justify-between">
          <button
            className={`${tabBaseClass} ${activeTab === 'albums' ? tabActiveClass : tabInactiveClass}`}
            onClick={() => handleTabChange('albums')}
            type="button"
          >
            <Layers size={16} />
            相册
          </button>
          <button
            className={`${tabBaseClass} ${activeTab === 'photos' ? tabActiveClass : tabInactiveClass}`}
            onClick={() => handleTabChange('photos')}
            type="button"
          >
            <ImageIcon size={16} />
            照片
          </button>
          <button
            className={`${tabBaseClass} ${activeTab === 'videos' ? tabActiveClass : tabInactiveClass}`}
            onClick={() => handleTabChange('videos')}
            type="button"
          >
            <Video size={16} />
            视频
          </button>
        </div>
      </nav>

      {viewer ? (
        <ImageViewer
          initialIndex={viewer.index}
          onClose={() => setViewer(null)}
          items={viewer.items}
        />
      ) : null}
    </div>
  );
}
