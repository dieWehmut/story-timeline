import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './context/ThemeContext';
import { SiteConfigProvider } from './context/SiteConfigContext';
import { MusicProvider } from './context/MusicContext';
import App from './components/App';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <SiteConfigProvider>
        <MusicProvider>
          <App />
        </MusicProvider>
      </SiteConfigProvider>
    </ThemeProvider>
  </StrictMode>
);
