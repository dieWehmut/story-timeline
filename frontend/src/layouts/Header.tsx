import { ArrowLeft, CalendarRange } from 'lucide-react';
import { ThemeButton } from './ThemeButton';
import { AuthButton } from './AuthButton';
import { UploadButton } from './UploadButton';
import type { AuthUser, CreateImagePayload, FeedUser, TimelineMonth } from '../types/image';

interface HeaderProps {
	activeMonth: TimelineMonth | null;
	authLoading: boolean;
	authUser: AuthUser | null;
	canPost: boolean;
	feedUsers: FeedUser[];
	filterUser: string | null;
	isDetailView?: boolean;
	onBack?: () => void;
	onFilterUser: (login: string | null) => void;
	onLogin: () => void;
	onLogout: () => Promise<void>;
	onThemeToggle: () => void;
	onTimelineToggle: () => void;
	onUpload: (payload: CreateImagePayload) => Promise<void>;
	theme: 'dark' | 'light';
	timelineOpen: boolean;
	uploadBusy: boolean;
}

export function Header({
	activeMonth,
	authLoading,
	authUser,
	canPost,
	feedUsers,
	filterUser,
	isDetailView,
	onBack,
	onFilterUser,
	onLogin,
	onLogout,
	onThemeToggle,
	onTimelineToggle,
	onUpload,
	theme,
	timelineOpen,
	uploadBusy,
}: HeaderProps) {
	return (
		<header className="fixed left-0 right-0 top-0 z-40 px-2 pt-2 md:px-3 md:pt-3">
			<div className="mx-auto flex w-full max-w-6xl items-center justify-between">
				<div className="flex items-center gap-3">
					{isDetailView ? (
						<button
							aria-label="返回"
							className="inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition hover:text-[var(--text-accent)] active:scale-95"
							onClick={onBack}
							type="button"
						>
							<ArrowLeft size={22} />
						</button>
					) : (
						<>
							<p className="font-serif text-xl font-semibold leading-none text-accent md:text-2xl">
								{activeMonth ? `${activeMonth.year}-${String(activeMonth.month).padStart(2, '0')}` : '---- --'}
							</p>
							{authUser ? (
								<p className="text-sm font-medium text-[var(--text-main)]">{authUser.login}</p>
							) : null}
						</>
					)}
				</div>
				<div className="flex items-center gap-0">
					{isDetailView ? (
						<ThemeButton onToggle={onThemeToggle} theme={theme} />
					) : (
						<>
							<AuthButton loading={authLoading} onLogin={onLogin} onLogout={onLogout} user={authUser} />
							<ThemeButton onToggle={onThemeToggle} theme={theme} />
							{authUser && canPost ? <UploadButton busy={uploadBusy} onSubmit={onUpload} /> : null}
							<div className={`transition-all duration-300 ${timelineOpen ? 'pointer-events-none scale-75 opacity-0' : 'opacity-100'}`}>
								<button
									aria-expanded={timelineOpen}
									aria-label="切换时间列"
									className="inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95"
									onClick={onTimelineToggle}
									type="button"
								>
									<CalendarRange size={24} />
								</button>
							</div>
						</>
					)}
				</div>
			</div>

			{/* Feed user avatars row */}
			{!isDetailView && feedUsers.length > 1 ? (
				<div className="mx-auto mt-2 flex w-full max-w-6xl items-center gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
					<button
						className={`all-chip shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
							filterUser === null
								? 'all-chip-active bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/40'
								: 'text-soft hover:text-[var(--text-main)]'
						}`}
						onClick={() => onFilterUser(null)}
						type="button"
					>
						All
					</button>
					{feedUsers.map((user) => (
						<button
							className={`flex shrink-0 items-center gap-1 transition-all duration-200 ${
								filterUser === user.login
									? 'scale-105 rounded-full bg-cyan-500/10 px-1.5 py-0.5'
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
									filterUser === user.login ? 'ring-2 ring-blue-400/80 ring-offset-2 ring-offset-transparent' : ''
								}`}
								src={user.avatarUrl}
							/>
							
						</button>
					))}
				</div>
			) : null}
		</header>
	);
}
