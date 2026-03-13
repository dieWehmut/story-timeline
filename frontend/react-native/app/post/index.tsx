import React, { useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/theme';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HomeButton } from '@/components/HomeButton';
import { PrimaryButton } from '@/components/PrimaryButton';
import { LoginModal } from '@/components/LoginModal';
import { useApp } from '@/providers/AppProvider';
import type { UploadFile } from '@/types/image';

type TimeMode = 'point' | 'range';

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { theme, auth, images } = useApp();
  const colors = Colors[theme];
  const [loginOpen, setLoginOpen] = useState(false);

  const item = useMemo(() => (id ? images.allItems.find((entry) => entry.id === id) ?? null : null), [id, images.allItems]);
  const mode: 'create' | 'edit' = id ? 'edit' : 'create';

  const [description, setDescription] = useState(item?.description ?? '');
  const [tags, setTags] = useState((item?.tags ?? []).join(', '));
  const [timeMode, setTimeMode] = useState<TimeMode>(item?.timeMode ?? 'point');
  const [startAt, setStartAt] = useState(item?.startAt ?? new Date().toISOString());
  const [endAt, setEndAt] = useState(item?.endAt ?? '');
  const [files, setFiles] = useState<UploadFile[]>([]);

  if (mode === 'edit' && !item && images.loading) {
    return (
      <Screen>
        <TopBar
          title="编辑记录"
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

  if (mode === 'edit' && !item && !images.loading) {
    return (
      <Screen>
        <TopBar
          title="编辑记录"
          showBack
          rightAction={
            <View style={styles.actions}>
              <HomeButton />
              <ThemeToggle />
            </View>
          }
        />
        <Text style={[styles.emptyText, { color: colors.textSoft }]}>未找到记录。</Text>
      </Screen>
    );
  }

  const handlePick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('需要权限', '请允许访问相册以选择媒体。');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    const mapped = result.assets.map((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName ?? `upload-${Date.now()}-${index}`,
      type: asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
    }));

    setFiles((prev) => [...prev, ...mapped]);
  };

  const handleSubmit = async () => {
    if (!auth.canPost) {
      Alert.alert('无权限', '请先登录。');
      return;
    }
    const payload = {
      description: description.trim(),
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      timeMode,
      startAt,
      endAt: timeMode === 'range' ? endAt : undefined,
      files,
    };

    try {
      if (mode === 'edit' && item) {
        await images.updateImage({ ...payload, id: item.id, files: files.length ? files : undefined });
      } else {
        await images.createImage(payload);
      }
      router.replace('/story');
    } catch (err: any) {
      Alert.alert('失败', err?.message ?? '提交失败');
    }
  };

  if (auth.loading) {
    return (
      <Screen>
        <TopBar
          title="记录"
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
          title="记录"
          showBack
          rightAction={
            <View style={styles.actions}>
              <HomeButton />
              <ThemeToggle />
            </View>
          }
        />
        <View style={styles.loginBlock}>
          <Text style={[styles.loginHint, { color: colors.textSoft }]}>请先登录后发布记录</Text>
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

  return (
    <Screen>
      <TopBar
        title={mode === 'edit' ? '编辑记录' : '新建记录'}
        showBack
        rightAction={
          <View style={styles.actions}>
            <HomeButton />
            <ThemeToggle />
          </View>
        }
      />

      <View style={[styles.card, { backgroundColor: colors.panelBg, borderColor: colors.panelBorder, shadowColor: colors.panelShadow }]}
      >
        <Text style={[styles.label, { color: colors.textSoft }]}>描述</Text>
        <TextInput
          style={[styles.input, styles.multiline, { borderColor: colors.panelBorder, color: colors.textMain }]}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          placeholder="记录故事..."
          placeholderTextColor={colors.textSoft}
        />

        <Text style={[styles.label, { color: colors.textSoft }]}>标签（逗号分隔）</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.panelBorder, color: colors.textMain }]}
          value={tags}
          onChangeText={setTags}
          placeholder="旅行, 生活, 记录"
          placeholderTextColor={colors.textSoft}
        />

        <Text style={[styles.label, { color: colors.textSoft }]}>时间模式</Text>
        <View style={styles.modeRow}>
          {(['point', 'range'] as TimeMode[]).map((modeKey) => (
            <Pressable
              key={modeKey}
              onPress={() => setTimeMode(modeKey)}
              style={[
                styles.modeButton,
                {
                  borderColor: timeMode === modeKey ? colors.textAccent : colors.panelBorder,
                  backgroundColor: timeMode === modeKey ? `${colors.textAccent}22` : 'transparent',
                },
              ]}
            >
              <Text style={[styles.modeText, { color: timeMode === modeKey ? colors.textAccent : colors.textSoft }]}
              >
                {modeKey === 'point' ? '单点' : '区间'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textSoft }]}>开始时间 (ISO)</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.panelBorder, color: colors.textMain }]}
          value={startAt}
          onChangeText={setStartAt}
          placeholder="2026-03-13T08:00:00Z"
          placeholderTextColor={colors.textSoft}
        />

        {timeMode === 'range' ? (
          <>
            <Text style={[styles.label, { color: colors.textSoft }]}>结束时间 (ISO)</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.panelBorder, color: colors.textMain }]}
              value={endAt}
              onChangeText={setEndAt}
              placeholder="2026-03-13T18:00:00Z"
              placeholderTextColor={colors.textSoft}
            />
          </>
        ) : null}

        <Pressable onPress={handlePick} style={[styles.pickButton, { borderColor: colors.panelBorder }]}
        >
          <Feather name="image" size={16} color={colors.textMain} />
          <Text style={[styles.pickText, { color: colors.textMain }]}>选择媒体</Text>
        </Pressable>

        {files.length ? (
          <View style={styles.previewRow}>
            {files.map((file) => (
              <Image key={file.uri} source={{ uri: file.uri }} style={styles.preview} />
            ))}
          </View>
        ) : null}

        <PrimaryButton label={images.submitting ? '提交中...' : '提交'} onPress={handleSubmit} disabled={images.submitting} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    marginTop: 10,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
  },
  modeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pickButton: {
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickText: {
    fontSize: 12,
    fontWeight: '600',
  },
  previewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  preview: {
    width: 80,
    height: 80,
    borderRadius: 10,
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
