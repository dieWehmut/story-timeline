import React, { useEffect } from 'react';
import { useSiteConfig } from '../context/SiteConfigContext';
import Home from '../pages/Home';
import ThemeToggle from './ThemeToggle';
import AuthButton from './AuthButton';
import MusicPlayer from './MusicPlayer';
import ScrollTopButton from './ScrollTopButton';
import '../styles/App.css';

const App: React.FC = () => {
  const { config } = useSiteConfig();

  useEffect(() => {
    // 更新网站标题
    if (config?.site_name) {
      document.title = config.site_name;
    }

    // 更新 favicon
    if (config?.favicon_url) {
      let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = config.favicon_url;
    }
  }, [config]);

  const backgroundStyle = config?.background_url
    ? {
        backgroundImage: `url(${config.background_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }
    : {};

  return (
    <div className="app" style={backgroundStyle}>
      <ThemeToggle />
      <AuthButton />
      <MusicPlayer />
      <ScrollTopButton />
      <Home />
    </div>
  );
};

export default App;
