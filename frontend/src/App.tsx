import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useImages } from './hooks/useImages';
import { AppLayout } from './layouts/AppLayout';
import Home from './pages/Home';
import Story from './pages/Story';
import Album from './pages/Album';
import Post from './pages/Post';
import { ToastProvider } from './ui/Toast';
import type { TimelineMonth } from './types/image';

const resolveTheme = (): 'dark' | 'light' => {
  const savedTheme = window.localStorage.getItem('story-theme');

  if (savedTheme === 'dark' || savedTheme === 'light') {
    return savedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(resolveTheme);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [activeMonth, setActiveMonth] = useState<TimelineMonth | null>(null);
  const auth = useAuth();
  const images = useImages();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('story-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!images.timeline.length || activeMonth) {
      return;
    }

    setActiveMonth(images.timeline[0]);
  }, [activeMonth, images.timeline]);

  const footerStats = {
    ...images.stats,
    githubOwner: images.stats.githubOwner || auth.user?.login || 'GitHub',
  };

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout footerStats={footerStats} />}>
            <Route
              path="/"
              element={<Home auth={auth} images={images} onThemeToggle={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))} theme={theme} />}
            />
            <Route
              path="/story"
              element={
                <Story
                  activeMonth={activeMonth}
                  auth={auth}
                  images={images}
                  onActiveMonthChange={setActiveMonth}
                  onThemeToggle={() => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))}
                  onTimelineClose={() => setTimelineOpen(false)}
                  onTimelineToggle={() => setTimelineOpen((open) => !open)}
                  theme={theme}
                  timelineOpen={timelineOpen}
                />
              }
            />
            <Route
              path="/album"
              element={<Album images={images} onThemeToggle={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))} theme={theme} />}
            />
            <Route
              path="/post"
              element={<Post auth={auth} images={images} />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
