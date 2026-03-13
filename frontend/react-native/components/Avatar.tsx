import React from 'react';
import { Image, StyleSheet, View, ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';
import { useApp } from '@/providers/AppProvider';

type AvatarProps = {
  uri?: string | null;
  size?: number;
  style?: ViewStyle;
};

export function Avatar({ uri, size = 40, style }: AvatarProps) {
  const { theme } = useApp();
  const colors = Colors[theme];

  if (!uri) {
    return <View style={[styles.placeholder, { width: size, height: size, borderColor: colors.panelBorder }, style]} />;
  }

  return (
    <Image
      source={{ uri }}
      style={[styles.image, { width: size, height: size, borderColor: colors.panelBorder }, style]}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    borderRadius: 999,
    borderWidth: 1,
  },
  placeholder: {
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#00000010',
  },
});
