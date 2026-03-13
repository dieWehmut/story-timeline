import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HomeButton } from '@/components/HomeButton';
import { UserRow } from '@/components/UserRow';
import { FooterBar } from '@/components/FooterBar';
import { LoginModal } from '@/components/LoginModal';
import { useApp } from '@/providers/AppProvider';

export default function FollowingScreen() {
  const router = useRouter();
  const { theme, auth, follows } = useApp();
  const colors = Colors[theme];
  const [loginOpen, setLoginOpen] = useState(false);

  if (auth.loading) {
    return (
      <Screen footer={<FooterBar />} footerHeight={86}>
        <TopBar
          title="关注"
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
      <Screen footer={<FooterBar />} footerHeight={86}>
        <TopBar
          title="关注"
          showBack
          rightAction={
            <View style={styles.actions}>
              <HomeButton />
              <ThemeToggle />
            </View>
          }
        />
        <View style={styles.loginBlock}>
          <Text style={[styles.loginHint, { color: colors.textSoft }]}>请先登录查看关注列表</Text>
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
    <Screen scroll={false} contentStyle={{ paddingHorizontal: 0 }} footer={<FooterBar />} footerHeight={86}>
      <FlatList
        ListHeaderComponent={
          <>
            <TopBar
              title="关注"
              subtitle={`${follows.following.length}`}
              showBack
              rightAction={
                <View style={styles.actions}>
                  <HomeButton />
                  <ThemeToggle />
                </View>
              }
            />
            {follows.error ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>{follows.error}</Text>
            ) : null}
          </>
        }
        data={follows.following}
        keyExtractor={(item) => item.login}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <UserRow
            login={item.login}
            avatarUrl={item.avatarUrl}
            followed
            canToggle={auth.user?.login?.toLowerCase() !== item.login.toLowerCase()}
            disabled={follows.loading}
            onPress={() => router.push({ pathname: '/story', params: { user: item.login } })}
            onToggle={() => follows.unfollow(item.login)}
          />
        )}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.textSoft }]}>暂无关注。</Text>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 13,
  },
  errorText: {
    marginHorizontal: 20,
    marginBottom: 8,
    fontSize: 12,
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
