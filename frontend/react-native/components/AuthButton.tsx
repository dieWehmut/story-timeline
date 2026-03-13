import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useApp } from '@/providers/AppProvider';
import { IconButton } from './IconButton';
import { LoginModal } from './LoginModal';

export function AuthButton() {
  const { auth, theme } = useApp();
  const colors = Colors[theme];
  const [open, setOpen] = useState(false);

  const handlePress = () => {
    if (auth.loading) return;
    if (auth.authenticated && auth.user) {
      void auth.logout();
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <IconButton onPress={handlePress}>
        <Feather
          name={auth.authenticated ? 'log-out' : 'user'}
          size={24}
          color={colors.textMain}
        />
      </IconButton>
      {!auth.authenticated || !auth.user ? (
        <LoginModal
          open={open}
          onClose={() => setOpen(false)}
          onSelect={auth.loginWith}
          onEmailLogin={auth.requestEmailLogin}
          showGoogle={!!auth.googleLoginUrl}
          showEmail={!!auth.requestEmailLogin}
        />
      ) : null}
    </>
  );
}
