import { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useLanguage, type Language } from '../context/LanguageContext';
import { useTranslation } from '../hooks/useTranslation';

interface LanguageSwitcherProps {
  className?: string;
}

export function LanguageSwitcher({ className = '' }: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const languages: { code: Language; name: string }[] = [
    { code: 'zh-CN', name: t('languages.zh-CN') },
    { code: 'zh-TW', name: t('languages.zh-TW') },
    { code: 'en', name: t('languages.en') },
    { code: 'ja', name: t('languages.ja') },
    { code: 'de', name: t('languages.de') },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        aria-label={t('tooltips.languageSwitcher')}
        className="inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95"
        onClick={() => setIsOpen(!isOpen)}
        title={t('tooltips.languageSwitcher')}
        type="button"
      >
        <Globe size={18} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-40 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] py-2 shadow-lg backdrop-blur-xl z-50">
          {languages.map((lang) => (
            <button
              key={lang.code}
              className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition hover:bg-white/5 ${
                language === lang.code ? 'text-[var(--text-accent)]' : 'text-[var(--text-main)]'
              }`}
              onClick={() => handleLanguageChange(lang.code)}
              type="button"
            >
              <span>{lang.name}</span>
              {language === lang.code && (
                <span className="text-[var(--text-accent)]">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}