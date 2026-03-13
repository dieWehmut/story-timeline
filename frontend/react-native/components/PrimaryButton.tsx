import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';
import { useApp } from '@/providers/AppProvider';

type PrimaryButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  variant?: 'solid' | 'ghost';
};

export function PrimaryButton({ label, onPress, disabled, style, variant = 'solid' }: PrimaryButtonProps) {
  const { theme } = useApp();
  const colors = Colors[theme];

  const isGhost = variant === 'ghost';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: isGhost ? 'transparent' : pressed ? colors.buttonHover : colors.buttonBg,
          borderColor: colors.panelBorder,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Text style={[styles.label, { color: colors.textMain }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});
