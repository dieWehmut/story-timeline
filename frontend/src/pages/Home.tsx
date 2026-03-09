import { useEffect, useMemo, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { CardDetail } from '../ui/CardDetail';
import { Footer } from '../layouts/Footer';
import { Header } from '../layouts/Header';
import { ImageCard } from '../layouts/ImageCard';
import { TimeColumn } from '../layouts/TimeColumn';
import { useAuth } from '../hooks/useAuth';
import { useImages } from '../hooks/useImages';
import type { TimelineMonth } from '../types/image';

interface HomeProps {
  activeMonth: TimelineMonth | null;
  auth: ReturnType<typeof useAuth>;
  images: ReturnType<typeof useImages>;
  onActiveMonthChange: (month: TimelineMonth) => void;
  onThemeToggle: () => void;
  onTimelineClose: () => void;
  onTimelineToggle: () => void;
  theme: 'dark' | 'light';
  timelineOpen: boolean;
}

const getMonthKey = (startAt: string) => {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date(startAt));

  const year = Number(parts.find((part) => part.type === 'year')?.value ?? '0');
  const month = Number(parts.find((part) => part.type === 'month')?.value ?? '0');

  return `${year}-${String(month).padStart(2, '0')}`;
};

export default function Home({
  activeMonth,
  auth,
  images,
  onActiveMonthChange,
  onThemeToggle,
  onTimelineClose,
  onTimelineToggle,
  theme,
  timelineOpen,
}: HomeProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const monthGroups = useMemo(
    () =>
      images.timeline.map((month) => ({
        month,
        items: images.items.filter((item) => getMonthKey(item.startAt) === month.key),
      })),
    [images.items, images.timeline]
  );

  const selectedItem = useMemo(
    () => (selectedItemId ? images.items.find((i) => i.id === selectedItemId) ?? null : null),
    [images.items, selectedItemId]
  );

  useEffect(() => {
    const nodes = images.timeline
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
          .find((node) => node.getBoundingClientRect().top <= activationOffset) ??
        nodes[0];

      const monthKey = current?.getAttribute('data-month-key');
      const month = images.timeline.find((item) => item.key === monthKey);

      if (month && month.key !== activeMonth?.key) {
        onActiveMonthChange(month);
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
  }, [activeMonth?.key, images.timeline, monthGroups, onActiveMonthChange]);

  const jumpToMonth = (month: TimelineMonth) => {
    const target = sectionRefs.current[month.key];
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    onActiveMonthChange(month);
    onTimelineClose();
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">


      <Header
        activeMonth={activeMonth}
        authLoading={auth.loading}
        authUser={auth.user}
        canPost={auth.canPost}
        feedUsers={images.feedUsers}
        filterUser={images.filterUser}
        isDetailView={selectedItemId !== null}
        onBack={() => setSelectedItemId(null)}
        onFilterUser={images.setFilterUser}
        onLogin={auth.login}
        onLogout={auth.logout}
        onThemeToggle={onThemeToggle}
        onTimelineToggle={onTimelineToggle}
        onUpload={(payload) => images.createImage(payload, auth.user ? { login: auth.user.login, avatarUrl: auth.user.avatarUrl } : undefined)}
        theme={theme}
        timelineOpen={timelineOpen}
        uploadBusy={images.submitting}
      />

      {timelineOpen && (
        <div className="fixed inset-0 z-30" onClick={onTimelineClose} />
      )}

      <TimeColumn activeMonth={activeMonth} months={images.timeline} onJump={jumpToMonth} open={timelineOpen} />

      <main className="relative mx-auto flex w-full max-w-xl flex-col px-0 pb-36 pt-28 md:px-0 md:pt-36">

        {images.error ? (
          <div className="mb-6 border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
            {images.error}
          </div>
        ) : null}

        {images.loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <LoaderCircle className="animate-spin text-cyan-300" size={28} />
          </div>
        ) : (
          <div className="divide-y divide-[var(--panel-border)]">
            {monthGroups.map(({ month, items }) => (
              <section
                className="scroll-mt-28 md:scroll-mt-36"
                data-month-key={month.key}
                key={month.key}
                ref={(node) => {
                  sectionRefs.current[month.key] = node;
                }}
              >
                <div className="divide-y divide-[var(--panel-border)]">
                  {items.map((item) => (
                    <ImageCard
                      busy={images.submitting}
                      canInteract={auth.authenticated}
                      editable={auth.user?.login === item.authorLogin}
                      fallbackAuthorLogin={images.stats.githubOwner || auth.user?.login || undefined}
                      item={item}
                      key={item.id}
                      onAvatarClick={(login) => images.setFilterUser(images.filterUser === login ? null : login)}
                      onCommentCountChange={images.incrementCommentCount}
                      onDelete={images.deleteImage}
                      onLikeChange={images.updateLike}
                      onOpenDetail={() => setSelectedItemId(item.id)}
                      onSave={images.updateImage}
                      roleLabel={item.authorLogin === images.stats.githubOwner ? '管理员' : undefined}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {selectedItemId === null ? (
        <Footer stats={{ ...images.stats, githubOwner: images.stats.githubOwner || auth.user?.login || 'GitHub' }} />
      ) : null}

      {selectedItem ? (
        <CardDetail
          canInteract={auth.authenticated}
          currentUserLogin={auth.user?.login}
          editable={auth.user?.login === selectedItem.authorLogin}
          fallbackAuthorLogin={images.stats.githubOwner || auth.user?.login || undefined}
          item={selectedItem}
          onCommentCountChange={images.incrementCommentCount}
          onDelete={images.deleteImage}
          onLikeChange={images.updateLike}
          onSave={images.updateImage}
          roleLabel={selectedItem.authorLogin === images.stats.githubOwner ? '管理员' : undefined}
        />
      ) : null}
    </div>
  );
}
