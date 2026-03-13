import React, { useMemo } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { Screen } from '@/components/Screen';
import { TagChip } from '@/components/TagChip';
import { TopBar } from '@/components/TopBar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HomeButton } from '@/components/HomeButton';
import { AuthButton } from '@/components/AuthButton';
import { Avatar } from '@/components/Avatar';
import { PrimaryButton } from '@/components/PrimaryButton';
import { FollowButton } from '@/components/FollowButton';
import { useApp } from '@/providers/AppProvider';
import { api } from '@/lib/api';

const dateOnlyFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timeOnlyFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const toDateKey = (value: Date) => {
  const parts = dateOnlyFormatter.formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  return `${year}-${month}-${day}`;
};

const toDisplayDateTime = (value: string) => {
  const date = new Date(value);
  const dateKey = toDateKey(date);
  const todayKey = toDateKey(new Date());
  const yesterdayKey = toDateKey(new Date(Date.now() - 86400000));
  const beforeYesterdayKey = toDateKey(new Date(Date.now() - 2 * 86400000));
  const timeText = timeOnlyFormatter.format(date);
  let label = dateKey;

  if (dateKey === todayKey) {
    label = '今天';
  } else if (dateKey === yesterdayKey) {
    label = '昨天';
  } else if (dateKey === beforeYesterdayKey) {
    label = '前天';
  }

  return `${label} ${timeText}`;
};

const toDisplayTime = (startAt: string, endAt?: string, timeMode?: 'point' | 'range') => {
  const startText = toDisplayDateTime(startAt);
  if (timeMode !== 'range' || !endAt) return startText;
  return `${startText} - ${toDisplayDateTime(endAt)}`;
};

export default function StoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme, auth, images, follows } = useApp();
  const colors = Colors[theme];

  const item = useMemo(() => images.allItems.find((entry) => entry.id === id) ?? null, [id, images.allItems]);

  const handleDelete = () => {
    if (!item) return;
    Alert.alert('删除记录', '删除后无法恢复。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await images.deleteImage(item.id);
            router.replace('/story');
          } catch (err: any) {
            Alert.alert('失败', err?.message ?? '删除失败');
          }
        },
      },
    ]);
  };

  if (!item) {
    return (
      <Screen>
        <TopBar
          title="物语"
          showBack
          rightAction={
            <View style={styles.actions}>
              <HomeButton />
              {!auth.authenticated ? <AuthButton /> : null}
              <ThemeToggle />
            </View>
          }
        />
        <Text style={[styles.emptyText, { color: colors.textSoft }]}>
          {images.loading ? '加载中...' : '未找到记录。'}
        </Text>
      </Screen>
    );
  }

  const isOwner = auth.user?.login?.toLowerCase() === item.authorLogin.toLowerCase();
  const canEdit = isOwner && auth.canPost;
  const followed = follows.isFollowing(item.authorLogin);
  const roleLabel = item.authorLogin === images.stats.githubOwner ? '管理员' : undefined;
  const timeText = toDisplayTime(item.startAt, item.endAt, item.timeMode);
  const roleBg = theme === 'light' ? 'rgba(17, 24, 39, 0.08)' : 'rgba(255, 255, 255, 0.08)';

  return (
    <Screen>
      <TopBar
        title="物语"
        showBack
        rightAction={
          <View style={styles.actions}>
            <HomeButton />
            {!auth.authenticated ? <AuthButton /> : null}
            <ThemeToggle />
          </View>
        }
      />
      <View style={[styles.card, { backgroundColor: colors.panelBg, borderColor: colors.panelBorder, shadowColor: colors.panelShadow }]}>
        <View style={styles.headerRow}>
          <View style={styles.userRow}>
            <Avatar uri={item.authorAvatar} size={40} />
            <View>
              <View style={styles.nameRow}>
                <Text style={[styles.author, { color: colors.textMain }]}>{item.authorLogin}</Text>
                {roleLabel ? (
                  <View style={[styles.rolePill, { backgroundColor: roleBg }]}
                  >
                    <Text style={[styles.roleText, { color: colors.textSoft }]}>{roleLabel}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.date, { color: colors.textSoft }]}>{timeText}</Text>
            </View>
          </View>
          {auth.authenticated && !isOwner ? (
            <FollowButton
              following={followed}
              onPress={() =>
                followed
                  ? follows.unfollow(item.authorLogin)
                  : follows.follow(item.authorLogin, item.authorAvatar)
              }
            />
          ) : null}
        </View>

        {item.imageUrls?.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaRow}>
            {item.imageUrls.map((url) => (
              <Image key={url} source={{ uri: url }} style={styles.media} resizeMode="cover" />
            ))}
          </ScrollView>
        ) : null}

        {item.description ? (
          <Text style={[styles.description, { color: colors.textMain }]}>{item.description}</Text>
        ) : null}

        {item.tags?.length ? (
          <View style={styles.tagRow}>
            {item.tags.map((tag) => (
              <TagChip key={tag} label={`#${tag}`} />
            ))}
          </View>
        ) : null}

        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: colors.textSoft }]}>
            {item.likeCount} 赞 · {item.commentCount} 评论
          </Text>
          <Pressable
            onPress={async () => {
              if (!auth.authenticated) return;
              try {
                const result = await api.toggleLike(item.authorLogin, item.id);
                images.updateLike(item.id, result.likeCount, result.liked);
              } catch (err: any) {
                Alert.alert('失败', err?.message ?? '点赞失败');
              }
            }}
            style={styles.likeButton}
          >
            <Feather name="heart" size={14} color={item.liked ? colors.danger : colors.textMain} />
            <Text style={[styles.likeText, { color: item.liked ? colors.danger : colors.textMain }]}>
              {item.liked ? '已赞' : '点赞'}
            </Text>
          </Pressable>
        </View>

        {canEdit ? (
          <View style={styles.ownerActions}>
            <PrimaryButton label="编辑" onPress={() => router.push({ pathname: '/post', params: { id: item.id } })} />
            <PrimaryButton label="删除" onPress={handleDelete} variant="ghost" />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginTop: 10,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  author: {
    fontSize: 14,
    fontWeight: '600',
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '500',
  },
  date: {
    fontSize: 11,
    marginTop: 2,
  },
  mediaRow: {
    marginBottom: 12,
  },
  media: {
    width: 240,
    height: 180,
    borderRadius: 14,
    marginRight: 10,
  },
  description: {
    fontSize: 18,
    lineHeight: 26,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  metaText: {
    fontSize: 11,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  likeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  ownerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
