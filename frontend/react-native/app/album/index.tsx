import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/theme';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HomeButton } from '@/components/HomeButton';
import { TagChip } from '@/components/TagChip';
import { LoginModal } from '@/components/LoginModal';
import { useApp } from '@/providers/AppProvider';
import { normalizeAssetTypes } from '@/lib/media';
import type { ImageItem } from '@/types/image';

type TabKey = 'albums' | 'photos' | 'videos';

type MediaEntry = {
  id: string;
  url: string;
  type: 'photo' | 'video';
  tags: string[];
};

export default function AlbumScreen() {
  const { user, tag } = useLocalSearchParams<{ user?: string; tag?: string }>();
  const { theme, auth, images } = useApp();
  const colors = Colors[theme];
  const [activeTab, setActiveTab] = useState<TabKey>('albums');
  const [activeTag, setActiveTag] = useState<string | null>(tag ?? null);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    if (typeof tag === 'string') {
      setActiveTag(tag);
    }
  }, [tag]);

  if (auth.loading) {
    return (
      <Screen>
        <TopBar
          title="相册"
          showBack
          rightAction={
            <View style={styles.actions}>
              <HomeButton />
              <ThemeToggle />
            </View>
          }
        />
        <Text style={[styles.emptyText, { color: colors.textSoft }]}>加载中...</Text>
      </Screen>
    );
  }

  if (!auth.authenticated) {
    return (
      <Screen>
        <TopBar
          title="相册"
          showBack
          rightAction={
            <View style={styles.actions}>
              <HomeButton />
              <ThemeToggle />
            </View>
          }
        />
        <View style={styles.loginBlock}>
          <Text style={[styles.loginHint, { color: colors.textSoft }]}>请先登录查看相册</Text>
          <Pressable
            onPress={() => setLoginOpen(true)}
            style={[styles.loginButton, { borderColor: colors.panelBorder }]}
          >
            <Text style={[styles.loginButtonText, { color: colors.textMain }]}>登录</Text>
          </Pressable>
        </View>
        <LoginModal
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          onSelect={auth.loginWith}
          onEmailLogin={auth.requestEmailLogin}
          showGoogle={!!auth.googleLoginUrl}
          showEmail={!!auth.requestEmailLogin}
        />
      </Screen>
    );
  }

  const scopedItems = useMemo(() => {
    if (!user) return images.allItems;
    return images.allItems.filter((item) => item.authorLogin.toLowerCase() === user.toLowerCase());
  }, [images.allItems, user]);

  const media = useMemo(() => {
    const entries: MediaEntry[] = [];
    scopedItems.forEach((item: ImageItem) => {
      const urls = item.imageUrls ?? [];
      const types = normalizeAssetTypes(urls, item.assetTypes);
      urls.forEach((url, index) => {
        entries.push({
          id: `${item.id}-${index}`,
          url,
          type: types[index] === 'video' ? 'video' : 'photo',
          tags: item.tags ?? [],
        });
      });
    });
    return entries;
  }, [scopedItems]);

  const photoEntries = useMemo(() => media.filter((entry) => entry.type === 'photo'), [media]);
  const videoEntries = useMemo(() => media.filter((entry) => entry.type === 'video'), [media]);

  const tagSummary = useMemo(() => {
    const counts = new Map<string, number>();
    photoEntries.forEach((entry) => {
      entry.tags.forEach((t) => {
        const key = t.trim().toLowerCase();
        if (!key) return;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
    });
    return [...counts.entries()].map(([key, count]) => ({ key, count }));
  }, [photoEntries]);

  const filteredPhotos = useMemo(() => {
    if (!activeTag) return photoEntries;
    const key = activeTag.trim().toLowerCase();
    return photoEntries.filter((entry) => entry.tags.some((t) => t.trim().toLowerCase() === key));
  }, [photoEntries, activeTag]);

  const renderPhoto = ({ item }: { item: MediaEntry }) => (
    <View style={styles.mediaCell}>
      <Image source={{ uri: item.url }} style={styles.mediaImage} />
    </View>
  );

  const renderVideo = ({ item }: { item: MediaEntry }) => (
    <View style={[styles.mediaCell, { backgroundColor: colors.pageBgSoft }]}
    >
      <Feather name="video" size={20} color={colors.textSoft} />
      <Text style={[styles.videoLabel, { color: colors.textSoft }]}>视频</Text>
    </View>
  );

  const tabActiveBg = theme === 'light' ? '#111827' : 'rgba(6, 182, 212, 0.2)';
  const tabActiveText = theme === 'light' ? '#f9fafb' : '#67e8f9';
  const tabActiveBorder = theme === 'light' ? '#111827' : colors.textAccent;
  const tabInactiveText = theme === 'light' ? '#111827' : colors.textSoft;
  const tabInactiveBorder = theme === 'light' ? '#111827' : colors.panelBorder;
  const tabIcons: Record<TabKey, keyof typeof Feather.glyphMap> = {
    albums: 'layers',
    photos: 'image',
    videos: 'video',
  };

  return (
    <Screen scroll={false} contentStyle={{ paddingHorizontal: 0 }}>
      <FlatList
        data={activeTab === 'videos' ? videoEntries : activeTab === 'photos' ? filteredPhotos : []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={activeTab === 'videos' ? renderVideo : renderPhoto}
        ListHeaderComponent={
          <View>
            <TopBar
              title="相册"
              subtitle={auth.authenticated ? auth.user?.login : '游客'}
              showBack
              rightAction={
                <View style={styles.actions}>
                  <HomeButton />
                  <ThemeToggle />
                </View>
              }
            />
            <View style={styles.tabRow}>
              {(['albums', 'photos', 'videos'] as TabKey[]).map((tab) => {
                const isActive = activeTab === tab;
                return (
                    <Pressable
                      key={tab}
                      onPress={() => setActiveTab(tab)}
                      style={[
                        styles.tabButton,
                      {
                        backgroundColor: isActive ? tabActiveBg : 'transparent',
                        borderColor: isActive ? tabActiveBorder : tabInactiveBorder,
                      },
                    ]}
                    >
                      <Feather name={tabIcons[tab]} size={14} color={isActive ? tabActiveText : tabInactiveText} />
                      <Text style={[styles.tabText, { color: isActive ? tabActiveText : tabInactiveText }]}
                      >
                        {tab === 'albums' ? '相册' : tab === 'photos' ? '照片' : '视频'}
                      </Text>
                    </Pressable>
                );
              })}
            </View>

            {activeTab === 'albums' ? (
              <View style={styles.tagSection}>
                <Text style={[styles.sectionTitle, { color: colors.textMain }]}>标签</Text>
                <View style={styles.tagRow}>
                  <TagChip label="All" active={!activeTag} onPress={() => setActiveTag(null)} />
                  {tagSummary.map((entry) => (
                    <TagChip
                      key={entry.key}
                      label={`${entry.key} (${entry.count})`}
                      active={activeTag?.toLowerCase() === entry.key}
                      onPress={() => {
                        setActiveTag(entry.key);
                        setActiveTab('photos');
                      }}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          activeTab === 'albums' ? null : (
            <Text style={[styles.emptyText, { color: colors.textSoft }]}>
              {images.loading ? '加载中...' : '暂无内容'}
            </Text>
          )
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tagSection: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mediaCell: {
    flex: 1,
    margin: 6,
    borderRadius: 12,
    overflow: 'hidden',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  videoLabel: {
    fontSize: 12,
    marginTop: 6,
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
  loginBlock: {
    marginTop: 40,
    alignItems: 'center',
    gap: 12,
  },
  loginHint: {
    fontSize: 13,
  },
  loginButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  loginButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
