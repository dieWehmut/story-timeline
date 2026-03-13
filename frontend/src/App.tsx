import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { LOGIN_RETURN_KEY, useAuth } from './hooks/useAuth';
import { useImages } from './hooks/useImages';
import { useFollows } from './hooks/useFollows';
import { AppLayout } from './layouts/AppLayout';
import Home from './pages/Home';
import Story from './pages/Story';
import Album from './pages/Album';
import Post from './pages/Post';
import Following from './pages/Following';
import Follower from './pages/Follower';
import AuthEmail from './pages/AuthEmail';
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
  const follows = useFollows(auth, { onChange: images.refreshFeedUsers });

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

  const LoginReturnHandler = ({ authenticated }: { authenticated: boolean }) => {
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
      if (!authenticated) return;
      let target = '';
      try {
        target = localStorage.getItem(LOGIN_RETURN_KEY) ?? '';
      } catch {
        target = '';
      }

      if (!target || !target.startsWith('/')) return;

      try {
        localStorage.removeItem(LOGIN_RETURN_KEY);
      } catch {
        // ignore
      }

      const current = `${location.pathname}${location.search}${location.hash}`;
      if (current === target) return;

      navigate(target, { replace: true });
    }, [authenticated, location.hash, location.pathname, location.search, navigate]);

    return null;
  };

  return (
    <ToastProvider>
      <BrowserRouter>
        <LoginReturnHandler authenticated={auth.authenticated} />
        <Routes>
          <Route element={<AppLayout footerStats={footerStats} />}>
            <Route
              path="/"
              element={<Home auth={auth} images={images} follows={follows} onThemeToggle={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))} theme={theme} />}
            />
            <Route
              path="/story"
              element={
                <Story
                  activeMonth={activeMonth}
                  auth={auth}
                  follows={follows}
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
              path="/story/:id"
              element={
                <Story
                  activeMonth={activeMonth}
                  auth={auth}
                  follows={follows}
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
              element={<Album auth={auth} images={images} onThemeToggle={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))} theme={theme} />}
            />
            <Route
              path="/post"
              element={<Post auth={auth} images={images} />}
            />
            <Route
              path="/following"
              element={<Following auth={auth} follows={follows} onThemeToggle={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))} theme={theme} />}
            />
            <Route
              path="/follower"
              element={<Follower auth={auth} follows={follows} onThemeToggle={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))} theme={theme} />}
            />
            <Route path="/auth/email" element={<AuthEmail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
