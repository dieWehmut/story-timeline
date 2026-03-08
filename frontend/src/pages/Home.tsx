import { useEffect, useMemo, useRef } from 'react';
import { LoaderCircle } from 'lucide-react';
import { AuthButton } from '../layouts/AuthButton';
import { Footer } from '../layouts/Footer';
import { ImageCard } from '../layouts/ImageCard';
import { ThemeButton } from '../layouts/ThemeButton';
import { TimeButton } from '../layouts/TimeButton';
import { TimeColumn } from '../layouts/TimeColumn';
import { UploadButton } from '../layouts/UploadButton';
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
    month: '2-digit',
  }).formatToParts(new Date(capturedAt));

  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '00';

  return `${year}-${month}`;
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
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const heroTimestamp = useMemo(() => {
    if (!images.items[0]) {
      return '北京时间 2026-3-8 00:00';
    }

    const parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(images.items[0].capturedAt));

    const year = parts.find((part) => part.type === 'year')?.value ?? '';
    const month = parts.find((part) => part.type === 'month')?.value ?? '';
    const day = parts.find((part) => part.type === 'day')?.value ?? '';
    const hour = parts.find((part) => part.type === 'hour')?.value ?? '';
    const minute = parts.find((part) => part.type === 'minute')?.value ?? '';

    return `${year}-${month}-${day} ${hour}:${minute}`;
  }, [images.items]);

  useEffect(() => {
    const nodes = Object.values(sectionRefs.current).filter(Boolean) as HTMLDivElement[];
    if (!nodes.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        if (!visible) {
          return;
        }

        const monthKey = visible.target.getAttribute('data-month-key');
        const month = images.timeline.find((item) => item.key === monthKey);

        if (month) {
          onActiveMonthChange(month);
        }
      },
      {
        rootMargin: '-20% 0px -55% 0px',
        threshold: [0.25, 0.5, 0.75],
      }
    );

    nodes.forEach((node) => observer.observe(node));

    return () => {
      observer.disconnect();
    };
  }, [images.timeline, onActiveMonthChange]);

  const jumpToMonth = (month: TimelineMonth) => {
    const target = Object.values(sectionRefs.current).find((node) => node?.getAttribute('data-month-key') === month.key);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    onActiveMonthChange(month);
    onTimelineClose();
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_30%),radial-gradient(circle_at_20%_20%,rgba(244,114,182,0.09),transparent_22%)]" />

      <div className="fixed left-4 top-4 z-40 rounded-[1.8rem] border border-white/10 bg-slate-950/40 px-4 py-3 backdrop-blur-xl md:left-8 md:top-8">
        <p className="text-xs uppercase tracking-[0.32em] text-soft">Current</p>
        <p className="mt-1 font-serif text-3xl font-semibold text-accent">
          {activeMonth ? `${activeMonth.year}-${String(activeMonth.month).padStart(2, '0')}` : '---- --'}
        </p>
      </div>

      <div className="fixed right-4 top-4 z-40 md:right-8 md:top-8">
        <TimeButton onToggle={onTimelineToggle} open={timelineOpen} />
      </div>

      <TimeColumn activeMonth={activeMonth} months={images.timeline} onJump={jumpToMonth} open={timelineOpen} />

      <div className="fixed bottom-32 left-4 z-40 flex w-[min(18rem,calc(100vw-2rem))] flex-col gap-3 md:bottom-36 md:left-8 md:w-72">
        <ThemeButton onToggle={onThemeToggle} theme={theme} />
        {auth.user ? <UploadButton busy={images.submitting} onSubmit={images.createImage} /> : null}
        <AuthButton loading={auth.loading} onLogin={auth.login} onLogout={auth.logout} user={auth.user} />
      </div>

      <main className="relative mx-auto flex w-full max-w-6xl flex-col px-4 pb-44 pt-28 md:px-8 md:pt-36">
        <section className="mb-10 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_24rem] lg:items-end">
          <div className="glass-panel rounded-[2.5rem] p-6 md:p-8">
            <p className="text-sm uppercase tracking-[0.34em] text-cyan-300/75">Beijing Timeline</p>
            <h1 className="mt-3 max-w-3xl font-serif text-4xl font-semibold leading-tight md:text-6xl">
              用时间整理故事，用图片保存现场。
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-soft md:text-lg">
              页面顶部显示当前滚动到的年月，右侧时间列可直接跳转到指定月份，所有时间统一按北京时间展示。登录后可上传、替换图片、修改说明与时间，也可以直接删除卡片。
            </p>
          </div>

          <div className="glass-panel rounded-[2.5rem] p-6 md:p-8">
            <p className="text-sm uppercase tracking-[0.34em] text-soft">Latest Moment</p>
            {images.items[0] ? (
              <>
                <div className="mt-4 overflow-hidden rounded-[1.8rem]">
                  <img alt={images.items[0].description} className="aspect-[4/5] w-full object-cover" src={images.items[0].imageUrl} />
                </div>
                <p className="mt-4 text-sm leading-7 text-soft">{images.items[0].description}</p>
              </>
            ) : (
              <div className="mt-4 rounded-[1.8rem] border border-dashed border-white/15 px-5 py-12 text-center text-soft">
                暂无图片
              </div>
            )}
            <p className="mt-4 text-xl font-semibold text-accent">{heroTimestamp}</p>
          </div>
        </section>

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
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {images.items.map((item) => (
              <div
                data-month-key={getMonthKey(item.capturedAt)}
                key={item.id}
                ref={(node) => {
                  sectionRefs.current[item.id] = node;
                }}
              >
                <ImageCard
                  busy={images.submitting}
                  editable={Boolean(auth.user)}
                  item={item}
                  onDelete={images.deleteImage}
                  onSave={images.updateImage}
                />
              </div>
            ))}
          </section>
        )}
      </main>

      <Footer stats={{ ...images.stats, githubOwner: images.stats.githubOwner || auth.user?.login || 'GitHub' }} />
    </div>
  );
}
