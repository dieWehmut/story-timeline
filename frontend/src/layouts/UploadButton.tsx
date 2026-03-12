import { ImagePlus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

interface UploadButtonProps {
  busy: boolean;
}

export function UploadButton({ busy }: UploadButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <button
      aria-label="发布新帖"
      className="inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95"
      disabled={busy}
      onClick={() => {
        navigate('/post', { state: { from: `${location.pathname}${location.search}` } });
      }}
      type="button"
    >
      <ImagePlus size={24} />
    </button>
  );
}
