import { useEffect, useMemo, useRef } from 'react';
import { LoaderCircle } from 'lucide-react';
import { FloatingActions } from '../layouts/FloatingActions';
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

const getMonthKey = (capturedAt: string) => {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date(capturedAt));

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
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const monthGroups = useMemo(
    () =>
      images.timeline.map((month) => ({
        month,
        items: images.items.filter((item) => getMonthKey(item.capturedAt) === month.key),
      })),
    [images.items, images.timeline]
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


      <Header activeMonth={activeMonth} authUser={auth.user} roleLabel={auth.roleLabel} onTimelineToggle={onTimelineToggle} timelineOpen={timelineOpen} />

      {timelineOpen && (
        <div className="fixed inset-0 z-30" onClick={onTimelineClose} />
      )}

      <TimeColumn activeMonth={activeMonth} months={images.timeline} onJump={jumpToMonth} open={timelineOpen} />

      <FloatingActions
        authLoading={auth.loading}
        isAdmin={auth.isAdmin}
        authUser={auth.user}
        onLogin={auth.login}
        onLogout={auth.logout}
        onThemeToggle={onThemeToggle}
        onUpload={images.createImage}
        theme={theme}
        uploadBusy={images.submitting}
      />

      <main className="relative mx-auto flex w-full max-w-6xl flex-col px-4 pb-36 pt-28 md:px-8 md:pt-36">

        {images.error ? (
          <div className="mb-6 rounded-[1.8rem] border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
            {images.error}
          </div>
        ) : null}

        {images.loading ? (
          <div className="glass-panel flex min-h-64 items-center justify-center rounded-[2.4rem]">
            <LoaderCircle className="animate-spin text-cyan-300" size={28} />
          </div>
        ) : (
          <div className="space-y-6">
            {monthGroups.map(({ month, items }) => (
              <section
                className="scroll-mt-28 md:scroll-mt-36"
                data-month-key={month.key}
                key={month.key}
                ref={(node) => {
                  sectionRefs.current[month.key] = node;
                }}
              >
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((item) => (
                    <ImageCard
                      busy={images.submitting}
                      editable={auth.isAdmin}
                      item={item}
                      key={item.id}
                      onDelete={images.deleteImage}
                      onSave={images.updateImage}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <Footer stats={{ ...images.stats, githubOwner: images.stats.githubOwner || auth.user?.login || 'GitHub' }} />
    </div>
  );
}
