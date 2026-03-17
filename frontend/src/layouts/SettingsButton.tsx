import { useState } from 'react';
import { Settings } from 'lucide-react';
import { ConfigModal } from '../ui/ConfigModal';
import { useAuthContext } from '../context/AuthContext';

const iconBtnCls =
  'inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95';

export function SettingsButton({ isAdmin: isAdminProp }: { isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const { isAdmin: isAdminContext } = useAuthContext();
  const isAdmin = isAdminProp ?? isAdminContext;

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
      <ConfigModal open={open} onClose={() => setOpen(false)} isAdmin={isAdmin} />
    </>
  );
}
