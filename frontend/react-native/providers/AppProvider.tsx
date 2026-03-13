import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Text, TextInput, useColorScheme } from 'react-native';
import { useFonts } from 'expo-font';
import type { TimelineMonth } from '@/types/image';
import { storage } from '@/lib/storage';
import { useAuth } from '@/hooks/useAuth';
import { useImages } from '@/hooks/useImages';
import { useFollows } from '@/hooks/useFollows';
import { Fonts } from '@/constants/theme';

type ThemeName = 'light' | 'dark';

type AppContextValue = {
  theme: ThemeName;
  toggleTheme: () => void;
  auth: ReturnType<typeof useAuth>;
  images: ReturnType<typeof useImages>;
  follows: ReturnType<typeof useFollows>;
  activeMonth: TimelineMonth | null;
  setActiveMonth: (month: TimelineMonth | null) => void;
};

const AppContext = createContext<AppContextValue | null>(null);
const THEME_KEY = 'story-theme';

const resolveTheme = (scheme: ThemeName | null | undefined, stored?: string | null): ThemeName => {
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return scheme === 'dark' ? 'dark' : 'light';
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState<ThemeName>(systemScheme === 'dark' ? 'dark' : 'light');
  const [fontsLoaded] = useFonts({
    [Fonts.primary]: require('@/assets/fonts/LXGWWenKai-Regular.ttf'),
  });
  const auth = useAuth();
  const images = useImages();
  const follows = useFollows(auth, { onChange: images.refreshFeedUsers });
  const [activeMonth, setActiveMonth] = useState<TimelineMonth | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const stored = await storage.getItem(THEME_KEY);
      if (cancelled) return;
      setTheme(resolveTheme(systemScheme, stored));
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [systemScheme]);

  useEffect(() => {
    if (!fontsLoaded) return;
    const existing = Text.defaultProps?.style;
    Text.defaultProps = Text.defaultProps || {};
    Text.defaultProps.style = [{ fontFamily: Fonts.primary }, existing];
    const inputExisting = TextInput.defaultProps?.style;
    TextInput.defaultProps = TextInput.defaultProps || {};
    TextInput.defaultProps.style = [{ fontFamily: Fonts.primary }, inputExisting];
  }, [fontsLoaded]);

  useEffect(() => {
    if (!images.timeline.length) {
      setActiveMonth(null);
      return;
    }
    if (!activeMonth || !images.timeline.some((month) => month.key === activeMonth.key)) {
      setActiveMonth(images.timeline[0]);
    }
  }, [activeMonth, images.timeline]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      void storage.setItem(THEME_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    theme,
    toggleTheme,
    auth,
    images,
    follows,
    activeMonth,
    setActiveMonth,
  }), [theme, toggleTheme, auth, images, follows, activeMonth]);

  if (!fontsLoaded) {
    return null;
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within AppProvider');
  }
  return ctx;
};
