import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Colors } from '@/constants/theme';
import { useApp } from '@/providers/AppProvider';
import type { FeedUser } from '@/types/image';
import { Avatar } from './Avatar';

type UserBarProps = {
  users: FeedUser[];
  activeUser: string | null;
  onSelect: (login: string | null) => void;
};

export function UserBar({ users, activeUser, onSelect }: UserBarProps) {
  const { theme } = useApp();
  const colors = Colors[theme];

  if (users.length <= 1) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Pressable
        onPress={() => onSelect(null)}
        style={[
          styles.allChip,
          {
            borderColor: colors.chipBorder,
            backgroundColor: activeUser === null ? colors.chipActiveBg : colors.chipBg,
          },
        ]}
      >
        <Text style={[styles.allLabel, { color: activeUser === null ? colors.chipActiveText : colors.chipText }]}>
          All
        </Text>
      </Pressable>
      {users.map((user) => {
        const isActive = activeUser === user.login;
        return (
          <Pressable
            key={user.login}
            onPress={() => onSelect(isActive ? null : user.login)}
            style={[
              styles.avatarWrap,
              { borderColor: isActive ? colors.textAccent : 'transparent' },
              activeUser && !isActive ? { opacity: 0.5 } : null,
            ]}
          >
            <Avatar uri={user.avatarUrl} size={28} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    gap: 10,
    alignItems: 'center',
  },
  allChip: {
    height: 28,
    width: 46,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  avatarWrap: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 1,
  },
});
