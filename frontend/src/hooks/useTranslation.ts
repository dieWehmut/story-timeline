import { useLanguage } from '../context/LanguageContext';
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

export function useTranslation() {
  const { language } = useLanguage();

  const t = (key: TranslationKey, params?: Record<string, string>): string => {
    const locale = locales[language];
    let value = getNestedValue(locale, key);

    if (typeof value === 'string') {
      // Replace template parameters like {{provider}}
      if (params) {
        Object.keys(params).forEach((param) => {
          value = value.replace(new RegExp(`\\{\\{${param}\\}\\}`, 'g'), params[param]);
        });
      }
      return value;
    }

    // Fallback to key if translation not found
    console.warn(`Translation not found for key: ${key} in language: ${language}`);
    return key;
  };

  return { t, language };
}