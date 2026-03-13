import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';
import { useApp } from '@/providers/AppProvider';

type CardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

export function Card({ children, style }: CardProps) {
  const { theme } = useApp();
  const colors = Colors[theme];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.panelBg,
          borderColor: colors.panelBorder,
          shadowColor: colors.panelShadow,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 6,
  },
});
