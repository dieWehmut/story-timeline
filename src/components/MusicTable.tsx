import React from 'react';
import { useMusic } from '../context/MusicContext';
import { isAdmin } from '../lib/auth';
import '../styles/MusicTable.css';

const MusicTable: React.FC = () => {
  const {
    musicList,
    currentIndex,
    isPlaying,
    volume,
    currentTime,
    duration,
    showMusicTable,
    showMusicList,
    play,
    pause,
    next,
    prev,
    setVolume,
    seek,
    setCurrentIndex,
    toggleMusicTable,
    toggleMusicList,
  } = useMusic();

  if (!showMusicTable) return null;

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  const currentMusic = musicList[currentIndex];
  const admin = isAdmin();

  return (
    <div className="music-table">
      <div className="music-controls">
        <button className="close-music-table" onClick={toggleMusicTable} aria-label="关闭">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* 1. 音乐名 */}
        <div className="current-music-info">
          {currentMusic && (
            <>
              <span className="music-title">{currentMusic.title}</span>
              
            </>
          )}
        </div>

        {/* 2. 音乐进度 */}
        <div className="progress-bar">
          <span className="time">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="seek-bar"
            style={{ 
              '--progress': `${duration ? (currentTime / duration) * 100 : 0}%` 
            } as React.CSSProperties}
          />
          <span className="time">{formatTime(duration)}</span>
        </div>

        {/* 3. 音量设置 */}
        <div className="volume-control">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="volume-bar"
            style={{ 
              '--progress': `${volume * 100}%` 
            } as React.CSSProperties}
          />
          <span className="volume-percentage">{Math.round(volume * 100)}%</span>
        </div>

        {/* 4. 四个按钮并排 */}
        <div className="control-buttons">
          <button onClick={prev} aria-label="上一首">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="19 20 9 12 19 4 19 20" />
              <line x1="5" y1="19" x2="5" y2="5" />
            </svg>
          </button>

          <button onClick={isPlaying ? pause : play} className="play-pause" aria-label={isPlaying ? '暂停' : '播放'}>
            {isPlaying ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>

          <button onClick={next} aria-label="下一首">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 4 15 12 5 20 5 4" />
              <line x1="19" y1="5" x2="19" y2="19" />
            </svg>
          </button>

          <button className="list-button" onClick={toggleMusicList} aria-label="播放列表">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>

          <span className="music-count-display">{currentIndex + 1}/{musicList.length}</span>
        </div>
      </div>

      {showMusicList && (
        <div className="music-list-container">
          {musicList.map((music, index) => (
            <div
              key={music.id}
              className={`music-list-item ${index === currentIndex ? 'active' : ''}`}
              onClick={() => setCurrentIndex(index)}
            >
              <span className="music-number">{index + 1}</span>
              <div className="music-details">
                <div className="music-title">{music.title}</div>
                
              </div>
              {index === currentIndex && isPlaying && (
                <span className="playing-indicator">♪</span>
              )}
            </div>
          ))}

          {musicList.length === 0 && (
            <div className="empty-music-list">
              {admin ? '暂无音乐，请在管理面板中添加' : '暂无音乐'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MusicTable;
