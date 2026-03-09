import { ThemeButton } from './ThemeButton';
import { AuthButton } from './AuthButton';
import { UploadButton } from './UploadButton';
import type { AuthUser, CreateImagePayload } from '../types/image';

interface FloatingActionsProps {
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
  authLoading: boolean;
  authUser: AuthUser | null;
  isAdmin: boolean;
  onLogin: () => void;
  onLogout: () => Promise<void>;
  uploadBusy: boolean;
  onUpload: (payload: CreateImagePayload) => Promise<void>;
}

export function FloatingActions({
  theme,
  onThemeToggle,
  authLoading,
  authUser,
  isAdmin,
  onLogin,
  onLogout,
  uploadBusy,
  onUpload,
}: FloatingActionsProps) {
  return (
    <div className="fixed bottom-2 left-2 z-50 flex flex-col gap-2 md:bottom-6 md:left-5">
      <ThemeButton onToggle={onThemeToggle} theme={theme} />
      {authUser && isAdmin ? <UploadButton busy={uploadBusy} onSubmit={onUpload} /> : null}
      <AuthButton loading={authLoading} onLogin={onLogin} onLogout={onLogout} user={authUser} />
    </div>
  );
}
