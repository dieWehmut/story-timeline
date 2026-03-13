import React, { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { Screen } from '@/components/Screen';
import { StoryCard } from '@/components/StoryCard';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AuthButton } from '@/components/AuthButton';
import { HomeButton } from '@/components/HomeButton';
import { UploadButton } from '@/components/UploadButton';
import { UserBar } from '@/components/UserBar';
import { TagBar } from '@/components/TagBar';
import { FooterBar } from '@/components/FooterBar';
import { TimelinePanel } from '@/components/TimelinePanel';
import { useApp } from '@/providers/AppProvider';
import type { ImageItem, TimelineMonth } from '@/types/image';

const toMonthLabel = (month: TimelineMonth | null) => {
  if (!month) return '---- --';
  return `${month.year}-${String(month.month).padStart(2, '0')}`;
};

const getMonthKey = (startAt: string) => {
  const date = new Date(startAt);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
};

export default function StoryScreen() {
  const router = useRouter();
  const { user, tag } = useLocalSearchParams<{ user?: string; tag?: string }>();
  const { theme, auth, images, follows, activeMonth, setActiveMonth } = useApp();
  const colors = Colors[theme];
  const quickBorder = theme === 'light' ? '#111827' : colors.panelBorder;
  const quickIconColor = theme === 'light' ? '#111827' : '#67e8f9';
  const quickSubColor = theme === 'light' ? '#111827' : colors.textSoft;
  const [timelineOpen, setTimelineOpen] = useState(false);

  const isUserScoped = !!images.filterUser;
  const scopedAllItems = useMemo(() => {
    if (!images.filterUser) return images.allItems;
    const normalized = images.filterUser.toLowerCase();
    return images.allItems.filter((item) => item.authorLogin.toLowerCase() === normalized);
  }, [images.allItems, images.filterUser]);
  const recordCount = scopedAllItems.length;
  const albumCount = scopedAllItems.reduce((sum, item) => sum + (item.imageUrls?.length ?? 0), 0);
  const recordDisabled = isUserScoped || !auth.canPost || images.submitting;

  const sections = useMemo(() => {
    return images.timeline.map((month) => ({
      month,
      data: images.items.filter((item) => getMonthKey(item.startAt) === month.key),
    }));
  }, [images.items, images.timeline]);

  const listRef = useRef<SectionList<ImageItem> | null>(null);

  React.useEffect(() => {
    if (user && images.filterUser !== user) {
      images.setFilterUser(user);
    }
    if (tag && images.tagFilter !== tag) {
      images.setTagFilter(tag);
    }
  }, [user, tag, images]);

  const header = (
    <View>
      <View style={styles.topRow}>
        <View style={styles.monthBlock}>
          <Text style={[styles.monthText, { color: colors.textAccent }]}>{toMonthLabel(activeMonth)}</Text>
          {auth.user ? (
            <Text style={[styles.userText, { color: colors.textMain }]}>{auth.user.login}</Text>
          ) : null}
        </View>
        <View style={styles.iconRow}>
          <HomeButton />
          {!auth.authenticated ? <AuthButton /> : null}
          {auth.user && auth.canPost ? <UploadButton disabled={images.submitting} /> : null}
          <ThemeToggle />
          <Pressable onPress={() => setTimelineOpen(true)} style={styles.iconButton}>
            <Feather name="calendar" size={24} color={colors.textMain} />
          </Pressable>
        </View>
      </View>

      <UserBar users={images.feedUsers} activeUser={images.filterUser} onSelect={images.setFilterUser} />
      <TagBar tags={images.tagSummary} selectedTag={images.tagFilter} onSelect={images.setTagFilter} />

      <View style={[styles.quickRow, { borderColor: quickBorder }]}>
        <Pressable
          onPress={() => router.push('/post')}
          disabled={recordDisabled}
          style={[
            styles.quickButton,
            { borderRightColor: quickBorder, borderRightWidth: 1, opacity: recordDisabled ? 0.5 : 1 },
          ]}
        >
          {!isUserScoped ? <Feather name="edit-3" size={20} color={quickIconColor} /> : null}
          <Text style={[styles.quickLabel, { color: quickIconColor }]}>记录</Text>
          {isUserScoped ? (
            <Text style={[styles.quickSubLabel, { color: quickSubColor }]}>{`总 ${recordCount} 帖`}</Text>
          ) : null}
        </Pressable>
        <Pressable
          onPress={() =>
            router.push({ pathname: '/album', params: { user: auth.user?.login || images.stats.githubOwner || 'GitHub' } })
          }
          style={styles.quickButton}
        >
          {!isUserScoped ? <Feather name="image" size={20} color={quickIconColor} /> : null}
          <Text style={[styles.quickLabel, { color: quickIconColor }]}>相册</Text>
          {isUserScoped ? (
            <Text style={[styles.quickSubLabel, { color: quickSubColor }]}>{`${albumCount} 项`}</Text>
          ) : null}
        </Pressable>
      </View>

      {images.error ? (
        <View style={[styles.errorBox, { borderColor: colors.danger }]}>
          <Text style={[styles.errorText, { color: colors.danger }]}>{images.error}</Text>
        </View>
      ) : null}
    </View>
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ section?: { month: TimelineMonth } }> }) => {
      const first = viewableItems.find((entry) => entry.section?.month);
      if (first?.section?.month && first.section.month.key !== activeMonth?.key) {
        setActiveMonth(first.section.month);
      }
    }
  ).current;

  return (
    <Screen scroll={false} footer={<FooterBar />} footerHeight={86}>
      <SectionList
        ref={listRef}
        ListHeaderComponent={header}
        sections={sections}
        keyExtractor={(item: ImageItem) => item.id}
        renderItem={({ item }) => {
          const isOwner = auth.user?.login?.toLowerCase() === item.authorLogin.toLowerCase();
          const editable = !!auth.canPost && isOwner;

          const handleDelete = () => {
            Alert.alert('删除记录', '删除后无法恢复。', [
              { text: '取消', style: 'cancel' },
              {
                text: '删除',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await images.deleteImage(item.id);
                  } catch (err: any) {
                    Alert.alert('失败', err?.message ?? '删除失败');
                  }
                },
              },
            ]);
          };

          return (
            <StoryCard
              item={item}
              roleLabel={item.authorLogin === images.stats.githubOwner ? '管理员' : undefined}
              editable={editable}
              onEdit={() => router.push({ pathname: '/post', params: { id: item.id } })}
              onDelete={handleDelete}
              onPress={() => router.push(`/story/${item.id}`)}
              onCommentPress={() => router.push(`/story/${item.id}`)}
              onUserPress={() => images.setFilterUser(images.filterUser === item.authorLogin ? null : item.authorLogin)}
              onTagPress={(tagValue) => images.setTagFilter(images.tagFilter === tagValue ? null : tagValue)}
              showFollow={auth.authenticated && auth.user?.login?.toLowerCase() !== item.authorLogin.toLowerCase()}
              followed={follows.isFollowing(item.authorLogin)}
              tagCounts={images.tagCountMap}
              onFollowToggle={() =>
                follows.isFollowing(item.authorLogin)
                  ? follows.unfollow(item.authorLogin)
                  : follows.follow(item.authorLogin, item.authorAvatar)
              }
            />
          );
        }}
        renderSectionHeader={() => null}
        ListEmptyComponent={
          images.loading ? (
            <Text style={[styles.emptyText, { color: colors.textSoft }]}>加载中...</Text>
          ) : (
            <Text style={[styles.emptyText, { color: colors.textSoft }]}>暂无记录</Text>
          )
        }
        contentContainerStyle={{ paddingBottom: 120 }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 20 }}
      />

      <TimelinePanel
        open={timelineOpen}
        months={images.timeline}
        activeMonth={activeMonth}
        order={images.timeOrder}
        onToggleOrder={images.toggleTimeOrder}
        onSelect={(month) => {
          const index = sections.findIndex((section) => section.month.key === month.key);
          if (index >= 0) {
            listRef.current?.scrollToLocation({
              sectionIndex: index,
              itemIndex: 0,
              viewOffset: 160,
              animated: true,
            });
          }
          setActiveMonth(month);
          setTimelineOpen(false);
        }}
        onClose={() => setTimelineOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginTop: 6,
  },
  monthBlock: {
    gap: 4,
  },
  monthText: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  userText: {
    fontSize: 12,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconButton: {
    height: 36,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickRow: {
    marginTop: 10,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  quickButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  quickLabel: {
    fontSize: 13,
  },
  quickSubLabel: {
    fontSize: 11,
  },
  errorBox: {
    marginTop: 10,
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  errorText: {
    fontSize: 12,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 30,
    fontSize: 12,
  },
});
