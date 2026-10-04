import type { Locale } from '../lib/i18n';
import type { Translations } from './types';
import { en } from './locales/en';
import { es } from './locales/es';
import { de } from './locales/de';
import { fr } from './locales/fr';
import { pt } from './locales/pt';
import { ja } from './locales/ja';
import { zhCn } from './locales/zh-cn';
import { zhTw } from './locales/zh-tw';
import { it } from './locales/it';
import { nl } from './locales/nl';

export * from './types';

export const TRANSLATIONS: Record<Locale, Translations> = {
  en,
  es,
  de,
  fr,
  pt,
  ja,
  'zh-cn': zhCn,
  'zh-tw': zhTw,
  it,
  nl,
};

export const getTranslations = (locale: Locale = 'en'): Translations => {
  return TRANSLATIONS[locale] || TRANSLATIONS.en;
};
