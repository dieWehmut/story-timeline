import { SUPPORTED_LANGUAGES, useLanguage, type Language } from '../context/LanguageContext';
import { locales, type LocaleKeys } from '../locales';

type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

type TranslationKey = NestedKeyOf<LocaleKeys>;

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

export const resolveStoredLanguage = (): Language => {
  try {
    const saved = localStorage.getItem('story-language');
    if (saved && SUPPORTED_LANGUAGES.includes(saved as Language)) {
      return saved as Language;
    }
  } catch {
    // ignore storage errors
  }
  return 'zh-CN';
};

export function translate(
  key: TranslationKey,
  params?: Record<string, string>,
  language: Language = resolveStoredLanguage()
): string {
  const locale = locales[language];
  let value = getNestedValue(locale, key);

  if (typeof value !== 'string') {
    value = getNestedValue(locales.en, key);
  }

  if (typeof value === 'string') {
    if (params) {
      Object.keys(params).forEach((param) => {
        value = value.replace(new RegExp(`\\{\\{${param}\\}\\}`, 'g'), params[param]);
      });
    }
    return value;
  }

  console.warn(`Translation not found for key: ${key} in language: ${language}`);
  return key;
}

export function useTranslation() {
  const { language } = useLanguage();

  const t = (key: TranslationKey, params?: Record<string, string>): string => {
    return translate(key, params, language);
  };

  return { t, language };
}
