import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { getSiteConfig, updateSiteConfig as updateConfig, incrementVisitorCount } from '../lib/siteConfig';
import type { SiteConfig } from '../lib/supabase';

interface SiteConfigContextType {
  config: SiteConfig | null;
  updateSiteConfig: (siteName?: string, faviconUrl?: string, backgroundUrl?: string) => Promise<void>;
  refreshConfig: () => Promise<void>;
}

const SiteConfigContext = createContext<SiteConfigContextType | undefined>(undefined);

export const SiteConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<SiteConfig | null>(null);

  const loadConfig = async () => {
    const data = await getSiteConfig();
    setConfig(data);
  };

  useEffect(() => {
    loadConfig();
    
    // 增加访客数
    const hasVisited = sessionStorage.getItem('hasVisited');
    if (!hasVisited) {
      incrementVisitorCount();
      sessionStorage.setItem('hasVisited', 'true');
    }
  }, []);

  const updateSiteConfig = async (
    siteName?: string,
    faviconUrl?: string,
    backgroundUrl?: string
  ) => {
    const success = await updateConfig(siteName, faviconUrl, backgroundUrl);
    if (success) {
      await loadConfig();
    }
  };

  const refreshConfig = async () => {
    await loadConfig();
  };

  return (
    <SiteConfigContext.Provider value={{ config, updateSiteConfig, refreshConfig }}>
      {children}
    </SiteConfigContext.Provider>
  );
};

export const useSiteConfig = () => {
  const context = useContext(SiteConfigContext);
  if (!context) {
    throw new Error('useSiteConfig must be used within SiteConfigProvider');
  }
  return context;
};
