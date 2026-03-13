import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Colors } from '@/constants/theme';
import { useApp } from '@/providers/AppProvider';

type FollowButtonProps = {
  following: boolean;
  disabled?: boolean;
  onPress?: () => void;
};

export function FollowButton({ following, disabled, onPress }: FollowButtonProps) {
  const { theme } = useApp();
  const colors = Colors[theme];

  const isLight = theme === 'light';
  const borderColor = isLight
    ? '#111827'
    : following
      ? 'rgba(248, 113, 113, 0.4)'
      : 'rgba(34, 211, 238, 0.4)';
  const textColor = isLight
    ? '#111827'
    : following
      ? '#fca5a5'
      : '#67e8f9';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.base, { borderColor, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={[styles.label, { color: textColor }]}>{following ? '取关' : '关注'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
});
