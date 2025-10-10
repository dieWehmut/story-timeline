import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { getMusicList } from '../lib/music';
import type { Music } from '../lib/supabase';

interface MusicContextType {
  musicList: Music[];
  currentIndex: number;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  showMusicTable: boolean;
  showMusicList: boolean;
  audioRef: React.RefObject<HTMLAudioElement>;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  setVolume: (volume: number) => void;
  seek: (time: number) => void;
  setCurrentIndex: (index: number) => void;
  toggleMusicTable: () => void;
  toggleMusicList: () => void;
  refreshMusicList: () => Promise<void>;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [musicList, setMusicList] = useState<Music[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.7);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showMusicTable, setShowMusicTable] = useState(false);
  const [showMusicList, setShowMusicList] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null!);

  const loadMusicList = async () => {
    const data = await getMusicList();
    setMusicList(data);
  };

  useEffect(() => {
    loadMusicList();
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => {
      if (musicList.length === 0) return;
      setCurrentIndex((prev) => (prev + 1) % musicList.length);
      setIsPlaying(true);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [musicList]);

  const play = () => {
    audioRef.current?.play();
    setIsPlaying(true);
  };

  const pause = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
  };

  const next = () => {
    if (musicList.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % musicList.length);
    setIsPlaying(true);
  };

  const prev = () => {
    if (musicList.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + musicList.length) % musicList.length);
    setIsPlaying(true);
  };

  const setVolume = (vol: number) => {
    setVolumeState(vol);
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const toggleMusicTable = () => {
    setShowMusicTable(prev => !prev);
  };

  const toggleMusicList = () => {
    setShowMusicList(prev => !prev);
  };

  const refreshMusicList = async () => {
    await loadMusicList();
  };

  useEffect(() => {
    if (musicList.length > 0 && audioRef.current) {
      audioRef.current.src = musicList[currentIndex]?.url || '';
      if (isPlaying) {
        audioRef.current.play().catch(err => console.error('Play error:', err));
      }
    }
  }, [currentIndex, musicList, isPlaying]);

  return (
    <MusicContext.Provider
      value={{
        musicList,
        currentIndex,
        isPlaying,
        volume,
        currentTime,
        duration,
        showMusicTable,
        showMusicList,
        audioRef,
        play,
        pause,
        next,
        prev,
        setVolume,
        seek,
        setCurrentIndex,
        toggleMusicTable,
        toggleMusicList,
        refreshMusicList,
      }}
    >
      {children}
      <audio ref={audioRef} />
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusic must be used within MusicProvider');
  }
  return context;
};
