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
  const [isVisible, setIsVisible] = useState(false);
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
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    // Delay visibility for smooth animation
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  };

  const handleClose = () => {
    setIsVisible(false);
    // Wait for animation to complete before hiding
    setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    handleClose();
  };

  const handleToggle = () => {
    if (isOpen) {
      handleClose();
    } else {
      handleOpen();
    }
  };

  return (
    <>
      {/* CSS animations inserted into document head */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes dropdownFadeIn {
            from {
              opacity: 0;
              transform: scale(0.95) translateY(-8px);
            }
            to {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }

          @keyframes dropdownFadeOut {
            from {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
            to {
              opacity: 0;
              transform: scale(0.95) translateY(-8px);
            }
          }

          @keyframes slideInLeft {
            from {
              opacity: 0;
              transform: translateX(-20px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          @keyframes slideOutLeft {
            from {
              opacity: 1;
              transform: translateX(0);
            }
            to {
              opacity: 0;
              transform: translateX(-20px);
            }
          }

          @keyframes checkmarkBounce {
            0% {
              opacity: 0;
              transform: scale(0);
            }
            50% {
              opacity: 1;
              transform: scale(1.2);
            }
            100% {
              opacity: 1;
              transform: scale(1);
            }
          }

          @keyframes globeRotate {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(180deg);
            }
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
              transition: 'transform 0.3s ease-out',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
            }}
          />
        </button>

        {isOpen && (
          <div
            className={`absolute right-0 top-full mt-2 w-40 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] py-2 backdrop-blur-xl z-50 origin-top-right`}
            style={{
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              animation: isVisible ? 'dropdownFadeIn 0.2s ease-out' : 'dropdownFadeOut 0.2s ease-in',
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(-8px)',
              transition: 'opacity 0.2s ease-out, transform 0.2s ease-out'
            }}
          >
            {languages.map((lang, index) => (
              <button
                key={lang.code}
                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-all duration-200 hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden ${
                  language === lang.code
                    ? 'text-[var(--text-accent)] bg-white/5'
                    : 'text-[var(--text-main)]'
                }`}
                onClick={() => handleLanguageChange(lang.code)}
                type="button"
                style={{
                  animation: isVisible
                    ? `slideInLeft 0.3s ease-out ${index * 0.05}s both`
                    : 'slideOutLeft 0.2s ease-in both',
                  transformOrigin: 'left center'
                }}
              >
                {/* Ripple effect on hover */}
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)'
                  }}
                />

                <span className="font-medium relative z-10">{lang.name}</span>
                {language === lang.code && (
                  <span
                    className="text-[var(--text-accent)] font-bold relative z-10"
                    style={{
                      animation: 'checkmarkBounce 0.4s ease-out'
                    }}
                  >
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
