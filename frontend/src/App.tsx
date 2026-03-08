import { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useImages } from './hooks/useImages';
import Home from './pages/Home';
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

  return (
    <Home
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
  );
}

export default App;
