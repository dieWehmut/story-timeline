import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Colors } from '@/constants/theme';
import { useApp } from '@/providers/AppProvider';

type TagChipProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
};

export function TagChip({ label, active = false, onPress }: TagChipProps) {
  const { theme } = useApp();
  const colors = Colors[theme];

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.base,
        {
          backgroundColor: active ? colors.chipActiveBg : colors.chipBg,
          borderColor: active ? colors.chipBorder : colors.chipBorder,
        },
      ]}
    >
      <Text style={[styles.label, { color: active ? colors.chipActiveText : colors.chipText }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
