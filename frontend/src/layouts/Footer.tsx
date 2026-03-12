import { useEffect, useState } from 'react';
import { User, Eye, TimerReset } from 'lucide-react';
import type { HealthStats } from '../types/image';

const UPTIME_START_AT = Date.parse('2025-10-10T09:00:00.000Z');

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
  const [uptimeSeconds, setUptimeSeconds] = useState(() => Math.max(0, Math.floor((Date.now() - UPTIME_START_AT) / 1000)));

  useEffect(() => {
    const sync = () => {
      setUptimeSeconds(Math.max(0, Math.floor((Date.now() - UPTIME_START_AT) / 1000)));
    };

    sync();
    const timer = window.setInterval(() => {
      sync();
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-30 bg-[color:var(--panel-bg)] px-5 py-1 backdrop-blur-xl md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-0.5 text-center text-xs text-soft">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-0 text-[var(--text-main)]">
          <span className="inline-flex items-center gap-1" title="累计用户">
            <User className="footer-icon text-cyan-300" size={12} />
            <span>{stats.userCount}</span>
          </span>
          <span className="inline-flex items-center gap-1" title="近 90 秒在线">
            <Eye className="footer-icon text-cyan-300" size={12} />
            <span>{stats.onlineUsers}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <TimerReset className="footer-icon text-cyan-300" size={12} />
            <span>{formatUptime(uptimeSeconds)}</span>
          </span>
        </div>
        <p>
          Copyright (c) 2025-2026{' '}
          <a
            href={`https://github.com/${stats.githubOwner}`}
            rel="noopener noreferrer"
            target="_blank"
            className="text-[var(--text-main)] underline decoration-transparent underline-offset-4 transition hover:decoration-current"
          >
            {stats.githubOwner}
          </a>
        </p>
      </div>
    </footer>
  );
}
