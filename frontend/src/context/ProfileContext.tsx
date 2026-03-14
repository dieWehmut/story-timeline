import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthUser } from '../types/image';
import { api } from '../lib/api';
import { broadcastAuthRefresh } from '../utils/authEvents';

type ProfileContextValue = {
  user: AuthUser | null;
  displayName: string;
  displayAvatar: string;
  backgroundImage: string;
  currentDisplayName: string;
  currentAvatar: string;
  setDisplayName: (name: string) => Promise<void>;
  setDisplayAvatar: (avatar: string) => Promise<void>;
  resetDisplayName: () => void;
  resetDisplayAvatar: () => void;
  setBackgroundImage: (image: string) => void;
  resetBackgroundImage: () => void;
  resolveName: (login: string) => string;
  resolveAvatar: (login: string, fallback?: string) => string;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

const BG_KEY = 'story-bg-image';

type ProfileProviderProps = {
  user: AuthUser | null;
  children: React.ReactNode;
};

export function ProfileProvider({ user, children }: ProfileProviderProps) {
  const loginKey = user?.login ? user.login.toLowerCase() : '';
  const [displayName, setDisplayNameState] = useState('');
  const [displayAvatar, setDisplayAvatarState] = useState('');
  const [backgroundImage, setBackgroundImageState] = useState('');

  useEffect(() => {
    if (!user) {
      setDisplayNameState('');
      setDisplayAvatarState('');
      return;
    }
    setDisplayNameState(user.displayName?.trim() ?? '');
    setDisplayAvatarState(user.avatarUrl ?? '');
  }, [user?.displayName, user?.avatarUrl, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setBackgroundImageState(localStorage.getItem(BG_KEY) ?? '');
    } catch {
      setBackgroundImageState('');
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (backgroundImage) {
      root.style.setProperty('--page-bg-image', `url("${backgroundImage}")`);
    } else {
      root.style.setProperty('--page-bg-image', 'none');
    }
  }, [backgroundImage]);

  const updateProfile = useCallback(
    async (payload: { displayName?: string; avatarUrl?: string }) => {
      if (!user) return;
      const prevName = displayName;
      const prevAvatar = displayAvatar;
      if (payload.displayName !== undefined) {
        setDisplayNameState(payload.displayName);
      }
      if (payload.avatarUrl !== undefined) {
        setDisplayAvatarState(payload.avatarUrl);
      }
      try {
        await api.updateProfile(payload);
        broadcastAuthRefresh();
      } catch {
        setDisplayNameState(prevName);
        setDisplayAvatarState(prevAvatar);
      }
    },
    [user, displayName, displayAvatar]
  );

  const setDisplayName = useCallback(
    async (name: string) => {
      const next = name.trim();
      await updateProfile({ displayName: next });
    },
    [updateProfile]
  );

  const setDisplayAvatar = useCallback(
    async (avatar: string) => {
      const next = avatar.trim();
      await updateProfile({ avatarUrl: next });
    },
    [updateProfile]
  );

  const resetDisplayName = useCallback(() => {
    void setDisplayName('');
  }, [setDisplayName]);

  const resetDisplayAvatar = useCallback(() => {
    void setDisplayAvatar('');
  }, [setDisplayAvatar]);

  const setBackgroundImage = useCallback((image: string) => {
    const next = image.trim();
    setBackgroundImageState(next);
    if (typeof window === 'undefined') return;
    try {
      if (next) {
        localStorage.setItem(BG_KEY, next);
      } else {
        localStorage.removeItem(BG_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const resetBackgroundImage = useCallback(() => setBackgroundImage(''), [setBackgroundImage]);

  const resolveName = useCallback(
    (login: string) => {
      if (!login) return '';
      if (loginKey && login.toLowerCase() === loginKey) {
        return displayName.trim() || login;
      }
      return login;
    },
    [displayName, loginKey]
  );

  const resolveAvatar = useCallback(
    (login: string, fallback?: string) => {
      if (loginKey && login.toLowerCase() === loginKey) {
        return displayAvatar || fallback || '';
      }
      return fallback || '';
    },
    [displayAvatar, loginKey]
  );

  const currentDisplayName = user ? (displayName.trim() || user.login) : '';
  const currentAvatar = user ? (displayAvatar || user.avatarUrl) : '';

  const value = useMemo(
    () => ({
      user,
      displayName,
      displayAvatar,
      backgroundImage,
      currentDisplayName,
      currentAvatar,
      setDisplayName,
      setDisplayAvatar,
      resetDisplayName,
      resetDisplayAvatar,
      setBackgroundImage,
      resetBackgroundImage,
      resolveName,
      resolveAvatar,
    }),
    [
      user,
      displayName,
      displayAvatar,
      backgroundImage,
      currentDisplayName,
      currentAvatar,
      setDisplayName,
      setDisplayAvatar,
      resetDisplayName,
      resetDisplayAvatar,
      setBackgroundImage,
      resetBackgroundImage,
      resolveName,
      resolveAvatar,
    ]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return context;
}
