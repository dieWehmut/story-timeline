import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useApp } from '@/providers/AppProvider';
import type { ImageItem } from '@/types/image';
import { Avatar } from './Avatar';
import { TagChip } from './TagChip';
import { FollowButton } from './FollowButton';
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

const toDisplayTime = (item: ImageItem) => {
  const startText = toDisplayDateTime(item.startAt);
  if (item.timeMode !== 'range' || !item.endAt) {
    return startText;
  }
  return `${startText} - ${toDisplayDateTime(item.endAt)}`;
};

type StoryCardProps = {
  item: ImageItem;
  onPress?: () => void;
  onUserPress?: () => void;
  onTagPress?: (tag: string) => void;
  followed?: boolean;
  showFollow?: boolean;
  onFollowToggle?: () => void;
  tagCounts?: Record<string, number>;
  roleLabel?: string;
  editable?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onCommentPress?: () => void;
};

export function StoryCard({
  item,
  onPress,
  onUserPress,
  onTagPress,
  followed,
  showFollow,
  onFollowToggle,
  tagCounts,
  roleLabel,
  editable = false,
  onEdit,
  onDelete,
  onCommentPress,
}: StoryCardProps) {
  const { theme, auth, images } = useApp();
  const colors = Colors[theme];
  const preview = item.imageUrls?.[0];
  const displayTime = toDisplayTime(item);
  const [likeBusy, setLikeBusy] = useState(false);
  const roleBg = theme === 'light' ? 'rgba(17, 24, 39, 0.08)' : 'rgba(255, 255, 255, 0.08)';

  const handleToggleLike = async (event: any) => {
    event?.stopPropagation?.();
    if (!auth.authenticated || likeBusy) return;
    setLikeBusy(true);
    const optimisticLiked = !item.liked;
    const optimisticCount = item.likeCount + (optimisticLiked ? 1 : -1);
    images.updateLike(item.id, optimisticCount, optimisticLiked);
    try {
      const result = await api.toggleLike(item.authorLogin, item.id);
      images.updateLike(item.id, result.likeCount, result.liked);
    } catch (err: any) {
      images.updateLike(item.id, item.likeCount, item.liked);
      Alert.alert('失败', err?.message ?? '点赞失败');
    } finally {
      setLikeBusy(false);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: colors.panelBg,
          borderColor: colors.panelBorder,
          shadowColor: colors.panelShadow,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Pressable onPress={onUserPress} style={styles.userRow}>
          <Avatar uri={item.authorAvatar} size={36} />
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
          </View>
        </Pressable>
        {editable ? (
          <View style={styles.editRow}>
            <Pressable
              onPress={(event) => {
                event?.stopPropagation?.();
                onEdit?.();
              }}
              style={styles.editButton}
            >
              <Feather name="edit-3" size={14} color={colors.textSoft} />
            </Pressable>
            <Pressable
              onPress={(event) => {
                event?.stopPropagation?.();
                onDelete?.();
              }}
              style={styles.editButton}
            >
              <Feather name="trash-2" size={14} color={colors.danger} />
            </Pressable>
          </View>
        ) : showFollow ? (
          <FollowButton following={!!followed} onPress={onFollowToggle} />
        ) : null}
      </View>
      {preview ? (
        <Image source={{ uri: preview }} style={styles.preview} resizeMode="cover" />
      ) : null}
      {item.description ? (
        <Text style={[styles.description, { color: colors.textMain }]} numberOfLines={3}>
          {item.description}
        </Text>
      ) : null}
      {item.tags?.length ? (
        <View style={styles.tagRow}>
          {item.tags.map((tag) => {
            const count = tagCounts?.[tag.trim().toLowerCase()] ?? 0;
            return (
              <TagChip
                key={`${item.id}-${tag}`}
                label={`#${tag}${count ? ` (${count})` : ''}`}
                onPress={() => onTagPress?.(tag)}
              />
            );
          })}
        </View>
      ) : null}
      <Text style={[styles.timeText, { color: colors.textSoft }]}>{displayTime}</Text>
      <View style={styles.actionRow}>
        <Pressable onPress={handleToggleLike} style={styles.actionButton}>
          <Feather name="heart" size={14} color={item.liked ? colors.danger : colors.textSoft} />
          {item.likeCount > 0 ? (
            <Text style={[styles.actionCount, { color: item.liked ? colors.danger : colors.textSoft }]}>
              {item.likeCount}
            </Text>
          ) : null}
        </Pressable>
        <Pressable
          onPress={(event) => {
            event?.stopPropagation?.();
            onCommentPress?.();
          }}
          style={styles.actionButton}
        >
          <Feather name="message-circle" size={14} color={colors.textSoft} />
          {item.commentCount > 0 ? (
            <Text style={[styles.actionCount, { color: colors.textSoft }]}>{item.commentCount}</Text>
          ) : null}
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
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
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editButton: {
    height: 28,
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    marginBottom: 10,
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
  timeText: {
    marginTop: 8,
    fontSize: 11,
  },
  actionRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 14,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionCount: {
    fontSize: 11,
  },
});
