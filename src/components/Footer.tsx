import React, { useState, useEffect } from 'react';
import { useSiteConfig } from '../context/SiteConfigContext';
import '../styles/Footer.css';

const Footer: React.FC = () => {
  const { config } = useSiteConfig();
  const [uptime, setUptime] = useState('');

  useEffect(() => {
    // 初始时间：2025-10-10 17:00:00 北京时间
    const startTime = new Date('2025-10-10T17:00:00+08:00').getTime();

    const updateUptime = () => {
      const now = Date.now();
      const diff = now - startTime;

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setUptime(`${days}天 ${hours}时 ${minutes}分 ${seconds}秒`);
    };

    updateUptime();
    const timer = setInterval(updateUptime, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <footer className="footer">
      <div className="footer-row visitor-count">
        访客数: {config?.visitor_count || 0}
      </div>
      <div className="footer-row uptime">
        Uptime: {uptime}
      </div>
      <div className="footer-row copyright">
        © 2025 dieSehnsucht. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
