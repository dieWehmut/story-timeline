import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { NotificationModal } from '../ui/NotificationModal';
import { api } from '../lib/api';

const iconBtnCls =
  'inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95';

function todayKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `notification_dismissed_${yyyy}-${mm}-${dd}`;
}

function isDismissedToday(): boolean {
  try {
    return localStorage.getItem(todayKey()) === '1';
  } catch {
    return false;
  }
}

function dismissToday(): void {
  try {
    localStorage.setItem(todayKey(), '1');
  } catch {
    // ignore
  }
}

interface NotificationButtonProps {
  isAdmin?: boolean;
}

export function NotificationButton({ isAdmin = false }: NotificationButtonProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ enabled: boolean; title: string; content: string } | null>(null);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    api.getNotification().then((res) => {
      setData(res);
      if (res.enabled && !isDismissedToday()) {
        setOpen(true);
      }
    }).catch(() => {
      // silent
    });
  }, []);

  const hasNotification = data?.enabled && data.content && !isDismissedToday();

  const handleDismissToday = () => {
    dismissToday();
    setOpen(false);
  };

  const handleSave = async (payload: { enabled: boolean; title: string; content: string }) => {
    const res = await api.updateNotification(payload);
    setData(res);
  };

  return (
    <>
      <button
        aria-label="通知"
        className={`${iconBtnCls} relative`}
        onClick={() => setOpen(true)}
        type="button"
      >
        <Bell size={22} />
        {hasNotification ? (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
        ) : null}
      </button>
      <NotificationModal
        open={open}
        title={data?.title ?? '公告'}
        content={data?.content ?? ''}
        enabled={data?.enabled ?? false}
        isAdmin={isAdmin}
        onClose={() => setOpen(false)}
        onDismissToday={handleDismissToday}
        onSave={isAdmin ? handleSave : undefined}
      />
    </>
  );
}