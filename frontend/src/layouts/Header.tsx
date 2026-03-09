import { TimeButton } from './TimeButton';
import type { AuthUser } from '../types/image';
import type { TimelineMonth } from '../types/image';

interface HeaderProps {
	activeMonth: TimelineMonth | null;
	authUser: AuthUser | null;
	roleLabel: string;
	timelineOpen: boolean;
	onTimelineToggle: () => void;
}

export function Header({ activeMonth, authUser, roleLabel, onTimelineToggle, timelineOpen }: HeaderProps) {
	return (
		<header className="fixed left-0 right-0 top-0 z-40 px-4 pt-4 md:px-4 md:pt-4">
			<div className="mx-auto flex w-full max-w-6xl items-center justify-between">
				<div className="flex items-center gap-3">
					<p className="font-serif text-xl font-semibold leading-none text-accent md:text-2xl">
						{activeMonth ? `${activeMonth.year}-${String(activeMonth.month).padStart(2, '0')}` : '---- --'}
					</p>
					{authUser ? (
						<p className="text-sm text-soft md:text-base">
							<span className="font-medium text-[var(--text-main)]">{authUser.login}</span>
							<span className="mx-2 text-white/25">/</span>
							<span>{roleLabel}</span>
						</p>
					) : null}
				</div>
				<div className={`transition-all duration-300 ${timelineOpen ? 'pointer-events-none scale-75 opacity-0' : 'opacity-100'}`}>
					<TimeButton onToggle={onTimelineToggle} open={timelineOpen} />
				</div>
			</div>
		</header>
	);
}
