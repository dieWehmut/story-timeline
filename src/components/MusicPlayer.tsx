import React from 'react';
import { useMusic } from '../context/MusicContext';
import '../styles/MusicPlayer.css';

const MusicPlayer: React.FC = () => {
  const { showMusicTable, toggleMusicTable } = useMusic();

  if (showMusicTable) return null;

  return (
    <button
      className="music-player-button"
      onClick={toggleMusicTable}
      aria-label="打开音乐播放器"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    </button>
  );
};

export default MusicPlayer;
