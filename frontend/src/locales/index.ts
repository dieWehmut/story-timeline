import type { Language } from '../context/LanguageContext';
import { zhCN, type LocaleKeys } from './zh-CN';
import { zhTW } from './zh-TW';
import { en } from './en';
import { ja } from './ja';
import { de } from './de';

const locales: Record<Language, LocaleKeys> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'en': en,
  'ja': ja,
  'de': de,
};

export { locales };
export type { LocaleKeys };