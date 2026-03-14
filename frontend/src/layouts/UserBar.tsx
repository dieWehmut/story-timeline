import type { FeedUser } from '../types/image';
import { useProfile } from '../context/ProfileContext';

interface UserBarProps {
  feedUsers: FeedUser[];
  filterUser: string | null;
  onFilterUser: (login: string | null) => void;
}

export function UserBar({ feedUsers, filterUser, onFilterUser }: UserBarProps) {
  const profile = useProfile();
  if (feedUsers.length <= 1) return null;

  return (
    <div
      className="mt-1 flex w-full max-w-6xl items-center justify-start gap-2 overflow-x-auto pb-0.5"
      style={{ scrollbarWidth: 'none' }}
    >
      <button
        className={`tag-chip shrink-0 rounded-full border border-cyan-400/25 px-2.5 py-1 text-xs transition ${
          filterUser === null ? 'tag-chip-active' : 'text-soft hover:text-[var(--text-main)]'
        }`}
        onClick={() => onFilterUser(null)}
        type="button"
      >
        All
      </button>
      {feedUsers.map((user) => {
        const isActive = filterUser === user.login;
        const displayName = profile.resolveName(user.login);
        const displayAvatar = profile.resolveAvatar(user.login, user.avatarUrl);
        return (
          <button
            className={`flex shrink-0 items-center gap-1 transition-all duration-200 ${
              isActive
                ? 'scale-105'
                : filterUser !== null
                  ? 'opacity-50 hover:opacity-80'
                  : 'hover:scale-105'
            }`}
            key={user.login}
            onClick={() => onFilterUser(filterUser === user.login ? null : user.login)}
            title={displayName || user.login}
            type="button"
          >
            <img
              alt={displayName || user.login}
              className="h-6 w-6 rounded-full object-cover"
              src={displayAvatar}
            />
          </button>
        );
      })}
    </div>
  );
}
