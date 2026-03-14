import { useEffect, useState } from 'react';
import { Copyright, Eye, TimerReset, User } from 'lucide-react';
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
    <footer className="fixed bottom-0 left-0 right-0 z-20 bg-[color:var(--panel-bg)] px-5 py-1 backdrop-blur-xl md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-0.5 text-center text-xs text-soft">
        <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0 text-[var(--text-main)]">
          <span className="inline-flex items-center gap-0.5" title="累计用户">
            <User className="footer-icon text-cyan-300" size={12} />
            <span>{stats.userCount}</span>
          </span>
          <span className="inline-flex items-center gap-0.5" title="近 10 秒在线">
            <Eye className="footer-icon text-cyan-300 online-pulse" size={12} />
            <span>{stats.onlineUsers}</span>
          </span>
          <span className="inline-flex items-center gap-0.5">
            <TimerReset className="footer-icon text-cyan-300" size={12} />
            <span>{formatUptime(uptimeSeconds)}</span>
          </span>
          <span className="inline-flex items-center gap-0.1" title="最后更新">
            <span>| Updated: {new Date().toISOString().slice(0, 10)}</span>
          </span>
        </div>
        <p className="flex items-center gap-1 text-[var(--text-main)] whitespace-nowrap">
          <Copyright className="footer-icon text-cyan-300" size={12} />
          <span>2025-2026</span>
          <a
            href={`https://github.com/${stats.githubOwner}`}
            rel="noopener noreferrer"
            target="_blank"
            className="underline underline-offset-4 decoration-current"
          >
            {stats.githubOwner}.
          </a>
          <span>All Rights Reserved.</span>
        </p>
      </div>
    </footer>
  );
}
