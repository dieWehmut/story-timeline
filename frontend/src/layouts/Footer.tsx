import { Activity, Eye, TimerReset } from 'lucide-react';
import type { HealthStats } from '../types/image';

interface FooterProps {
  stats: HealthStats;
}

const formatUptime = (uptimeSeconds: number) => {
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

export function Footer({ stats }: FooterProps) {
  return (
    <footer className="glass-panel fixed bottom-0 left-0 right-0 z-30 rounded-t-[2rem] px-5 py-4 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 text-sm text-soft md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-4 text-[var(--text-main)]">
          <span className="inline-flex items-center gap-2">
            <Activity className="text-cyan-300" size={16} />
            {stats.visitorCount}
          </span>
          <span className="inline-flex items-center gap-2">
            <Eye className="text-cyan-300" size={16} />
            {stats.activeViewers}
          </span>
        </div>
        <div className="inline-flex items-center gap-2">
          <TimerReset className="text-cyan-300" size={16} />
          <span>Uptime: {formatUptime(stats.uptimeSeconds)}</span>
        </div>
        <p>Copyright © 2025-2026 {stats.githubOwner}</p>
      </div>
    </footer>
  );
}