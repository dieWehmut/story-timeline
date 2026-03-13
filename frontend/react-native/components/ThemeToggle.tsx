import React from 'react';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useApp } from '@/providers/AppProvider';
import { IconButton } from './IconButton';

export function ThemeToggle() {
  const { theme, toggleTheme } = useApp();
  const colors = Colors[theme];
  const icon = theme === 'dark' ? 'sun' : 'moon';

  return (
    <IconButton onPress={toggleTheme}>
      <Feather name={icon} size={24} color={colors.textMain} />
    </IconButton>
  );
}
