import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Typography } from '@/constants/theme';
import { Screen } from '@/components/Screen';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AuthButton } from '@/components/AuthButton';
import { FooterBar } from '@/components/FooterBar';
import { useApp } from '@/providers/AppProvider';

type NavCardProps = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  subLabel?: string;
  disabled?: boolean;
  onPress?: () => void;
};

function NavCard({ icon, label, subLabel, disabled, onPress }: NavCardProps) {
  const { theme } = useApp();
  const colors = Colors[theme];
  const iconColor = theme === 'light' ? '#111827' : '#67e8f9';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.navCard,
        {
          backgroundColor: colors.panelBg,
          borderColor: colors.panelBorder,
          shadowColor: colors.panelShadow,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Feather name={icon} size={26} color={iconColor} />
      <Text style={[styles.navLabel, { color: colors.textMain }]}>{label}</Text>
      {subLabel ? (
        <Text style={[styles.navSubLabel, { color: colors.textSoft }]}>{subLabel}</Text>
      ) : null}
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { theme, auth, images, follows } = useApp();
  const colors = Colors[theme];

  const githubOwner = images.stats.githubOwner || auth.user?.login || 'GitHub';
  const repoUrl = `https://github.com/${githubOwner}/story-timeline`;
  const androidUrl = `${repoUrl}/releases/latest`;
  const albumUser = auth.user?.login || githubOwner;

  const followingCount = follows.following.length;
  const followerCount = follows.followers.length;

  return (
    <Screen footer={<FooterBar />} footerHeight={86}>
      <View style={styles.topRow}>
        <View style={styles.topLeft}>
          <AuthButton />
          {auth.user ? (
            <Text style={[styles.userLabel, { color: colors.textMain }]}>{auth.user.login}</Text>
          ) : null}
        </View>
        <ThemeToggle />
      </View>

      <View style={styles.titleBlock}>
        <Text style={[styles.title, { color: colors.textMain }]}>物语集</Text>
        <Text style={[styles.subtitle, { color: colors.textSoft }]}>记录故事</Text>
      </View>

      <View style={styles.grid}>
        <NavCard icon="book-open" label="物语" onPress={() => router.push('/story')} />
        <NavCard
          icon="image"
          label="相册"
          onPress={() => router.push({ pathname: '/album', params: { user: albumUser } })}
          disabled={!auth.authenticated}
        />
        <NavCard
          icon="user-check"
          label="关注"
          subLabel={auth.authenticated ? `${followingCount} 人` : undefined}
          onPress={() => router.push('/following')}
          disabled={!auth.authenticated}
        />
        <NavCard
          icon="users"
          label="粉丝"
          subLabel={auth.authenticated ? `${followerCount} 人` : undefined}
          onPress={() => router.push('/follower')}
          disabled={!auth.authenticated}
        />
        <NavCard icon="github" label="代码仓库" onPress={() => Linking.openURL(repoUrl)} />
        <NavCard icon="download" label="Android" onPress={() => Linking.openURL(androidUrl)} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginTop: 8,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  titleBlock: {
    marginTop: 14,
    alignItems: 'center',
    gap: 6,
  },
  title: {
    ...Typography.title,
    fontSize: 32,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
  },
  grid: {
    marginTop: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
  },
  navCard: {
    width: '47.5%',
    minHeight: 112,
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 6,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  navSubLabel: {
    fontSize: 11,
  },
});
