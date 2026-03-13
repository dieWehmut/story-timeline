import React from 'react';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useApp } from '@/providers/AppProvider';
import { IconButton } from './IconButton';

type UploadButtonProps = {
  disabled?: boolean;
};

export function UploadButton({ disabled }: UploadButtonProps) {
  const router = useRouter();
  const { theme } = useApp();
  const colors = Colors[theme];

  return (
    <IconButton
      onPress={() => {
        if (!disabled) router.push('/post');
      }}
    >
      <Feather name="edit-3" size={24} color={disabled ? colors.textSoft : colors.textMain} />
    </IconButton>
  );
}
