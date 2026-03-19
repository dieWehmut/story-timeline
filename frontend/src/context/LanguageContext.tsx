import { createContext, useContext, useEffect, useState, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

export const SUPPORTED_LANGUAGES = ['zh-CN', 'zh-TW', 'en', 'ja', 'de', 'fr', 'es', 'la'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Error boundary for language provider
class LanguageErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('LanguageProvider error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div>Language loading...</div>;
    }

    return this.props.children;
  }
}

const STORAGE_KEY = 'story-language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Initialize language more defensively
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED_LANGUAGES.includes(saved as Language)) {
        return saved as Language;
      }
    } catch (error) {
      console.warn('Failed to load language from localStorage:', error);
    }
    return 'zh-CN';
  });

  const setLanguage = (lang: Language) => {
    try {
      setLanguageState(lang);
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    } catch (error) {
      console.warn('Failed to save language:', error);
      // Still update state even if localStorage fails
      setLanguageState(lang);
    }
  };

  useEffect(() => {
    // Update document language attribute
    try {
      document.documentElement.lang = language;
    } catch (error) {
      console.warn('Failed to set document language:', error);
    }
  }, [language]);

  return (
    <LanguageErrorBoundary>
      <LanguageContext.Provider value={{ language, setLanguage }}>
        {children}
      </LanguageContext.Provider>
    </LanguageErrorBoundary>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);

  if (!context) {
    // More helpful error with fallback
    console.error('useLanguage must be used within LanguageProvider');
    // Return a fallback to prevent app crash in production
    if (import.meta.env.PROD) {
      return {
        language: 'zh-CN',
        setLanguage: () => console.warn('LanguageProvider not available')
      };
    }
    throw new Error('useLanguage must be used within LanguageProvider');
  }

  return context;
}
