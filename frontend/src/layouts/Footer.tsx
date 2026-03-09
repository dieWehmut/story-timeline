import { useEffect, useState } from 'react';
import { Activity, Eye, TimerReset } from 'lucide-react';
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
    <footer className="fixed bottom-0 left-0 right-0 z-30 bg-[color:var(--panel-bg)] px-5 py-2 backdrop-blur-xl md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-2 text-center text-sm text-soft">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[var(--text-main)]">
          <span className="inline-flex items-center gap-2" title="累计用户">
            <Activity className="text-cyan-300" size={16} />
            <span>用户 {stats.userCount}</span>
          </span>
          <span className="inline-flex items-center gap-2" title="近 90 秒在线">
            <Eye className="text-cyan-300" size={16} />
            <span>在线 {stats.onlineUsers}</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <TimerReset className="text-cyan-300" size={16} />
            <span>{formatUptime(uptimeSeconds)}</span>
          </span>
        </div>
        <p>Copyright © 2025-2026 {stats.githubOwner}</p>
      </div>
    </footer>
  );
}