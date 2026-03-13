import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useApp } from '@/providers/AppProvider';
import { IconButton } from './IconButton';

type TopBarProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  bordered?: boolean;
};

export function TopBar({ title, subtitle, showBack = false, onBack, rightAction, bordered = false }: TopBarProps) {
  const { theme } = useApp();
  const colors = Colors[theme];
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack?.()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <View style={[styles.root, bordered ? { borderBottomColor: colors.panelBorder, borderBottomWidth: 1 } : null]}>
      <View style={styles.left}>
        {showBack ? (
          <IconButton onPress={handleBack}>
            <Feather name="arrow-left" size={22} color={colors.textMain} />
          </IconButton>
        ) : null}
      </View>
      <View style={styles.center}>
        <Text style={[styles.title, { color: colors.textMain }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.textSoft }]}>{subtitle}</Text> : null}
      </View>
      <View style={styles.right}>{rightAction}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  left: {
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  right: {
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
});
