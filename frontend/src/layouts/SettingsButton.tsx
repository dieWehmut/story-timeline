import { useState } from 'react';
import { Settings } from 'lucide-react';
import { ConfigModal } from '../ui/ConfigModal';

const iconBtnCls =
  'inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95';

export function SettingsButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label="设置"
        className={iconBtnCls}
        onClick={() => setOpen(true)}
        type="button"
      >
        <Settings size={22} />
      </button>
      <ConfigModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
