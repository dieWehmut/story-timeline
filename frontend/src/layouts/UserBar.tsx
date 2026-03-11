import type { FeedUser } from '../types/image';

interface UserBarProps {
  feedUsers: FeedUser[];
  filterUser: string | null;
  onFilterUser: (login: string | null) => void;
}

export function UserBar({ feedUsers, filterUser, onFilterUser }: UserBarProps) {
  if (feedUsers.length <= 1) return null;

  return (
    <div
      className="mx-auto mt-2 flex w-full max-w-6xl items-center gap-3 overflow-x-auto pb-0.5"
      style={{ scrollbarWidth: 'none' }}
    >
      <button
        className={`all-chip shrink-0 rounded-full border border-transparent px-3 py-1 text-xs font-medium transition ${
          filterUser === null ? 'all-chip-active' : 'text-soft hover:text-[var(--text-main)]'
        }`}
        onClick={() => onFilterUser(null)}
        type="button"
      >
        All
      </button>
      {feedUsers.map((user) => {
        const isActive = filterUser === user.login;
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
            title={user.login}
            type="button"
          >
            <img
              alt={user.login}
              className={`h-6 w-6 rounded-full object-cover ${
                isActive ? 'ring-2 ring-blue-400/80 ring-offset-2 ring-offset-transparent' : ''
              }`}
              src={user.avatarUrl}
            />
          </button>
        );
      })}
    </div>
  );
}
