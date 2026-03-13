import React from 'react';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useApp } from '@/providers/AppProvider';
import { IconButton } from './IconButton';

export function HomeButton() {
  const router = useRouter();
  const { theme } = useApp();
  const colors = Colors[theme];

  return (
    <IconButton onPress={() => router.replace('/')}>
      <Feather name="home" size={22} color={colors.textMain} />
    </IconButton>
  );
}
