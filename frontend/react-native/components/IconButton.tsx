import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';
import { useApp } from '@/providers/AppProvider';

type IconButtonProps = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
};

export function IconButton({ children, onPress, style }: IconButtonProps) {
  const { theme } = useApp();
  const colors = Colors[theme];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { color: colors.textMain, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 36,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
