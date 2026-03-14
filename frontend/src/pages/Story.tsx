import { useEffect, useMemo, useRef, useState } from 'react';
import { Image as ImageIcon, LoaderCircle } from 'lucide-react';
import { CardDetail } from '../ui/CardDetail';
import { Header } from '../layouts/Header';
import { ImageCard } from '../layouts/ImageCard';
import { FloatingActions } from '../layouts/FloatingActions';
import { TimeColumn } from '../layouts/TimeColumn';
import { UploadButton } from '../layouts/UploadButton';
import { useAuth } from '../hooks/useAuth';
import { useImages } from '../hooks/useImages';
import { useFollows } from '../hooks/useFollows';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { TimelineMonth } from '../types/image';

interface StoryProps {
  activeMonth: TimelineMonth | null;
  auth: ReturnType<typeof useAuth>;
  follows: ReturnType<typeof useFollows>;
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

export default function Story({
  activeMonth,
  auth,
  follows,
  images,
  onActiveMonthChange,
  onThemeToggle,
  onTimelineClose,
  onTimelineToggle,
  theme,
  timelineOpen,
}: StoryProps) {
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const quickActionsRef = useRef<HTMLDivElement | null>(null);
  const [quickActionsVisible, setQuickActionsVisible] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeId } = useParams();
  const selectedItemId = routeId ?? null;
  const selectedUser = searchParams.get('user');
  const selectedTag = searchParams.get('tag');
  const activeUser = selectedUser && selectedUser !== 'all' ? selectedUser : null;
  const activeTag = selectedTag && selectedTag !== 'all' ? selectedTag : null;
  const isUserScoped = !!activeUser;

  const scopedAllItems = useMemo(() => {
    if (!activeUser) return images.allItems;
    const normalized = activeUser.toLowerCase();
    return images.allItems.filter((item) => item.authorLogin.toLowerCase() === normalized);
  }, [activeUser, images.allItems]);

  const recordCount = scopedAllItems.length;
  const albumCount = scopedAllItems.reduce((sum, item) => sum + (item.imageUrls?.length ?? 0), 0);

  const albumOwner = activeUser || auth.user?.login || images.stats.githubOwner || 'GitHub';
  const albumHref = `/album?user=${encodeURIComponent(albumOwner)}`;
  const recordDisabled = isUserScoped || !auth.canPost || images.submitting;
  const showQuickActions = selectedItemId === null;

  useEffect(() => {
    if (!showQuickActions) {
      setQuickActionsVisible(false);
      return;
    }

    const node = quickActionsRef.current;
    if (!node) {
      setQuickActionsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setQuickActionsVisible(entry.isIntersecting),
      { rootMargin: '-96px 0px 0px 0px', threshold: 0.1 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [showQuickActions]);

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
    if (images.filterUser !== activeUser) {
      images.setFilterUser(activeUser);
    }
    if (images.tagFilter !== activeTag) {
      images.setTagFilter(activeTag);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUser, activeTag]);

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

  const updateSearchParams = (nextUser: string | null, nextTag: string | null) => {
    const params = new URLSearchParams();
    if (nextUser) params.set('user', nextUser);
    if (nextTag) params.set('tag', nextTag);
    const search = params.toString();

    if (selectedItemId) {
      const target = `/story${search ? `?${search}` : ''}`;
      navigate(target, { replace: true });
      return;
    }

    if (!search) {
      setSearchParams({});
      return;
    }
    setSearchParams(params);
  };

  const handleUserSelect = (login: string | null) => {
    updateSearchParams(login, activeTag);
  };

  const handleTagSelect = (tag: string | null) => {
    updateSearchParams(activeUser, tag);
  };

  const handleFollowToggle = async (login: string, nextFollow: boolean, avatarUrl?: string) => {
    if (nextFollow) {
      await follows.follow(login, avatarUrl);
      return;
    }
    await follows.unfollow(login);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <Header
        activeMonth={activeMonth}
        authAuthenticated={auth.authenticated}
        authLoginUrl={auth.loginUrl}
        authGoogleLoginUrl={auth.googleLoginUrl}
        authEmailLoginUrl={auth.emailLoginUrl}
        authLoading={auth.loading}
        authUser={auth.user}
        canPost={auth.canPost}
        feedUsers={images.feedUsers}
        filterUser={activeUser}
        isDetailView={selectedItemId !== null}
        onBack={() => navigate(`/story${location.search}`)}
        onFilterUser={handleUserSelect}
        onLogin={auth.loginWith}
        onEmailLogin={auth.requestEmailLogin}
        emailPolling={auth.emailPolling}
        onLogout={auth.logout}
        onTagSelect={handleTagSelect}
        onThemeToggle={onThemeToggle}
        onTimelineToggle={onTimelineToggle}
        tagFilter={activeTag}
        tagSummary={images.tagSummary}
        theme={theme}
        timelineOpen={timelineOpen}
        uploadBusy={images.submitting}
        showUploadButton={!quickActionsVisible}
      />

      {timelineOpen && (
        <div className="fixed inset-0 z-30" onClick={onTimelineClose} />
      )}

      <TimeColumn
        activeMonth={activeMonth}
        months={images.timeline}
        onJump={jumpToMonth}
        onToggleOrder={images.toggleTimeOrder}
        open={timelineOpen}
        order={images.timeOrder}
      />

      <main className="relative mx-auto flex w-full max-w-xl flex-col px-0 pb-36 pt-28 md:px-0 md:pt-36">
        {showQuickActions ? (
          <div
            className="quick-actions grid w-full grid-cols-2 border-y border-[var(--panel-border)]"
            ref={quickActionsRef}
          >
              <UploadButton
                busy={images.submitting}
              className="quick-actions-button border-r border-[var(--panel-border)]"
                disabled={recordDisabled}
              label="記錄"
              showIcon={!isUserScoped}
              subLabel={isUserScoped ? `\u603b ${recordCount} \u5e16` : undefined}
              variant="card"
              />
              <button
              className={`quick-actions-button group flex w-full flex-col items-center justify-center gap-1 px-4 py-3 text-sm text-[var(--text-main)] transition ${
                isUserScoped ? '' : 'hover:text-[var(--text-accent)]'
              }`}
                onClick={() => navigate(albumHref)}
                type="button"
              >
              {!isUserScoped ? (
                <ImageIcon className="quick-actions-icon text-cyan-300 transition group-hover:text-[var(--text-accent)]" size={20} />
              ) : null}
              <span className="leading-none">{'相册'}</span>
            {isUserScoped ? (
                <span className="quick-actions-sub text-xs text-soft">{`${albumCount} \u9879`}</span>
            ) : null}
            </button>
          </div>
        ) : null}
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
                      canInteract={auth.authenticated}
                      editable={auth.user?.login === item.authorLogin}
                      fallbackAuthorLogin={images.stats.githubOwner || auth.user?.login || undefined}
                      followed={follows.isFollowing(item.authorLogin)}
                      item={item}
                      key={item.id}
                      onAvatarClick={(login) => handleUserSelect(activeUser === login ? null : login)}
                      onCommentCountChange={images.incrementCommentCount}
                      onDelete={images.deleteImage}
                      onLikeChange={images.updateLike}
                      onFollowToggle={handleFollowToggle}
                      onOpenDetail={() => navigate(`/story/${item.id}${location.search}`)}
                      onTagClick={(tag) => handleTagSelect(activeTag === tag ? null : tag)}
                      roleLabel={item.authorLogin === images.stats.githubOwner ? '管理员' : undefined}
                      tagCounts={images.tagCountMap}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {selectedItem ? (
        <CardDetail
          canInteract={auth.authenticated}
          currentUserLogin={auth.user?.login}
          editable={auth.user?.login === selectedItem.authorLogin}
          fallbackAuthorLogin={images.stats.githubOwner || auth.user?.login || undefined}
          followed={follows.isFollowing(selectedItem.authorLogin)}
          item={selectedItem}
          onCommentCountChange={images.incrementCommentCount}
          onDelete={images.deleteImage}
          onLikeChange={images.updateLike}
          onFollowToggle={handleFollowToggle}
          onTagClick={(tag) => handleTagSelect(activeTag === tag ? null : tag)}
          roleLabel={selectedItem.authorLogin === images.stats.githubOwner ? '管理员' : undefined}
          tagCounts={images.tagCountMap}
        />
      ) : null}

      <FloatingActions hidden={timelineOpen || selectedItemId !== null} />
    </div>
  );
}

