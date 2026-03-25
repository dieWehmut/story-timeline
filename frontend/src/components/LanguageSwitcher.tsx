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
    { code: 'fr', name: t('languages.fr') },
    { code: 'es', name: t('languages.es') },
    { code: 'la', name: t('languages.la') },
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

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* CSS animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .language-dropdown {
            opacity: 0;
            transform: scale(0.95) translateY(-8px);
            pointer-events: none;
            transition: opacity 0.15s ease-out, transform 0.15s ease-out;
          }

          .language-dropdown.open {
            opacity: 1;
            transform: scale(1) translateY(0);
            pointer-events: auto;
          }

          .language-item {
            opacity: 0;
            transform: translateX(-10px);
          }

          .language-dropdown.open .language-item {
            animation: slideInItem 0.2s ease-out forwards;
          }

          @keyframes slideInItem {
            from {
              opacity: 0;
              transform: translateX(-10px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          .language-item:nth-child(1) { animation-delay: 0.02s; }
          .language-item:nth-child(2) { animation-delay: 0.04s; }
          .language-item:nth-child(3) { animation-delay: 0.06s; }
          .language-item:nth-child(4) { animation-delay: 0.08s; }
          .language-item:nth-child(5) { animation-delay: 0.10s; }
          .language-item:nth-child(6) { animation-delay: 0.12s; }
          .language-item:nth-child(7) { animation-delay: 0.14s; }
          .language-item:nth-child(8) { animation-delay: 0.16s; }

          @keyframes checkmarkPop {
            0% {
              opacity: 0;
              transform: scale(0.5);
            }
            50% {
              transform: scale(1.1);
            }
            100% {
              opacity: 1;
              transform: scale(1);
            }
          }

          .checkmark-icon {
            animation: checkmarkPop 0.3s ease-out;
          }
        `
      }} />

      <div className={`relative ${className}`} ref={dropdownRef}>
        <button
          aria-label={t('tooltips.languageSwitcher')}
          className={`inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95 ${
            isOpen ? 'text-[var(--text-accent)] scale-110' : ''
          }`}
          onClick={handleToggle}
          title={t('tooltips.languageSwitcher')}
          type="button"
        >
          <Globe
            size={18}
            style={{
              transition: 'transform 0.25s ease-out',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
            }}
          />
        </button>

        <div
          className={`language-dropdown ${isOpen ? 'open' : ''} absolute right-0 top-full mt-2 w-40 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] py-2 backdrop-blur-xl z-50 origin-top-right`}
          style={{
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          }}
        >
          {languages.map((lang) => (
            <button
              key={lang.code}
              className={`language-item flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-all duration-150 hover:bg-white/10 active:scale-[0.98] relative overflow-hidden ${
                language === lang.code
                  ? 'text-[var(--text-accent)] bg-white/5'
                  : 'text-[var(--text-main)]'
              }`}
              onClick={() => handleLanguageChange(lang.code)}
              type="button"
            >
              <span className="font-medium relative z-10">{lang.name}</span>
              {language === lang.code && (
                <span className="checkmark-icon text-[var(--text-accent)] font-bold relative z-10">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
