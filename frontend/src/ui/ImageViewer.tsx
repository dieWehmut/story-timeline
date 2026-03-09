import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageViewerProps {
  urls: string[];
  initialIndex?: number;
  onClose: () => void;
}

export function ImageViewer({ urls, initialIndex = 0, onClose }: ImageViewerProps) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex((i) => (i > 0 ? i - 1 : i));
      if (e.key === 'ArrowRight') setIndex((i) => (i < urls.length - 1 ? i + 1 : i));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, urls.length]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90" onClick={onClose}>
      <button
        className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center text-white/70 hover:text-white transition"
        onClick={onClose}
        type="button"
      >
        <X size={24} />
      </button>

      {urls.length > 1 && index > 0 ? (
        <button
          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center text-white/60 hover:text-white transition"
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => i - 1);
          }}
          type="button"
        >
          <ChevronLeft size={28} />
        </button>
      ) : null}

      {urls.length > 1 && index < urls.length - 1 ? (
        <button
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center text-white/60 hover:text-white transition"
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => i + 1);
          }}
          type="button"
        >
          <ChevronRight size={28} />
        </button>
      ) : null}

      <img
        alt=""
        className="max-h-[90vh] max-w-[95vw] object-contain select-none"
        onClick={(e) => e.stopPropagation()}
        src={urls[index]}
      />

      {urls.length > 1 ? (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/60">
          {index + 1} / {urls.length}
        </div>
      ) : null}
    </div>
  );
}
