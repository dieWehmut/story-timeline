import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';
import { useApp } from '@/providers/AppProvider';

type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  footer?: React.ReactNode;
  footerHeight?: number;
};

export function Screen({ children, scroll = true, style, contentStyle, footer, footerHeight = 74 }: ScreenProps) {
  const { theme } = useApp();
  const colors = Colors[theme];

  if (scroll) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.pageBg }, style]}>
        <View style={styles.flex}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: (contentStyle?.paddingBottom as number | undefined) ?? (footer ? footerHeight + 18 : 28) },
              contentStyle,
            ]}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
          {footer ? <View style={[styles.footerWrap, { height: footerHeight }]}>{footer}</View> : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.pageBg }, style]}>
      <View style={styles.flex}>
        <View style={[styles.scrollContent, contentStyle]}>{children}</View>
        {footer ? <View style={[styles.footerWrap, { height: footerHeight }]}>{footer}</View> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  footerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
