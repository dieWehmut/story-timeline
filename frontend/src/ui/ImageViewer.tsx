import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MediaItem } from '../lib/media';

interface ImageViewerProps {
  items: MediaItem[];
  initialIndex?: number;
  onClose: () => void;
}

export function ImageViewer({ items, initialIndex = 0, onClose }: ImageViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const [offsetX, setOffsetX] = useState(0);
  const touchRef = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);

  const goPrev = useCallback(() => setIndex((i) => (i > 0 ? i - 1 : i)), []);
  const goNext = useCallback(() => setIndex((i) => (i < items.length - 1 ? i + 1 : i)), [items.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, goPrev, goNext]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchRef.current = { startX: touch.clientX, startY: touch.clientY, moved: false };
    setOffsetX(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const dx = e.touches[0].clientX - touchRef.current.startX;
    const dy = e.touches[0].clientY - touchRef.current.startY;
    // Only track horizontal swipes
    if (!touchRef.current.moved && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 1) {
      touchRef.current.moved = true;
    }
    if (touchRef.current.moved) {
      e.preventDefault();
      setOffsetX(dx);
    }
  };

  const handleTouchEnd = () => {
    const threshold = Math.min(40, Math.max(16, window.innerWidth * 0.05));
    if (touchRef.current?.moved) {
      if (offsetX < -threshold) goNext();
      else if (offsetX > threshold) goPrev();
    }
    touchRef.current = null;
    setOffsetX(0);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black"
      onClick={onClose}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
    >
      <button
        className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center text-white/70 hover:text-white transition"
        onClick={onClose}
        type="button"
      >
        <X size={24} />
      </button>

      {items.length > 1 && index > 0 ? (
        <button
          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center text-white/60 hover:text-white transition"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          type="button"
        >
          <ChevronLeft size={28} />
        </button>
      ) : null}

      {items.length > 1 && index < items.length - 1 ? (
        <button
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center text-white/60 hover:text-white transition"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          type="button"
        >
          <ChevronRight size={28} />
        </button>
      ) : null}

      {items[index]?.type === 'video' ? (
        <video
          className="max-h-full max-w-full object-contain select-none transition-transform duration-150"
          autoPlay
          controls
          key={items[index].url}
          onClick={(e) => e.stopPropagation()}
          playsInline
          src={items[index].url}
          style={offsetX ? { transform: `translateX(${offsetX}px)`, transition: 'none' } : undefined}
        />
      ) : (
        <img
          alt=""
          className="max-h-full max-w-full object-contain select-none transition-transform duration-150"
          draggable={false}
          key={items[index]?.url}
          onClick={(e) => e.stopPropagation()}
          src={items[index]?.url ?? ''}
          style={offsetX ? { transform: `translateX(${offsetX}px)`, transition: 'none' } : undefined}
        />
      )}

      {items.length > 1 ? (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/60">
          {index + 1} / {items.length}
        </div>
      ) : null}
    </div>
  );
}
