import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { useApp } from '@/providers/AppProvider';
import { Avatar } from './Avatar';
import { FollowButton } from './FollowButton';

type UserRowProps = {
  login: string;
  avatarUrl: string;
  followed?: boolean;
  canToggle?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  onToggle?: () => void;
};

export function UserRow({ login, avatarUrl, followed, canToggle, disabled, onPress, onToggle }: UserRowProps) {
  const { theme } = useApp();
  const colors = Colors[theme];

  return (
    <View style={[styles.row, { borderBottomColor: colors.panelBorder }]}>
      <Pressable onPress={onPress} style={styles.userInfo}>
        <Avatar uri={avatarUrl} size={38} />
        <Text style={[styles.login, { color: colors.textMain }]}>{login}</Text>
      </Pressable>
      {canToggle ? (
        <FollowButton following={!!followed} onPress={onToggle} disabled={disabled} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  login: {
    fontSize: 14,
    fontWeight: '500',
  },
});
