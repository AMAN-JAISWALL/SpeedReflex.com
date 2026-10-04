export type Locale = 'en' | 'es' | 'de' | 'fr' | 'pt' | 'ja' | 'zh-cn' | 'zh-tw' | 'it' | 'nl';

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALES: readonly Locale[] = [
  'en',
  'es',
  'de',
  'fr',
  'pt',
  'ja',
  'zh-cn',
  'zh-tw',
  'it',
  'nl',
] as const;

export const NON_DEFAULT_LOCALES: readonly Locale[] = [
  'es',
  'de',
  'fr',
  'pt',
  'ja',
  'zh-cn',
  'zh-tw',
  'it',
  'nl',
] as const;

export interface LocaleInfo {
  code: Locale;
  hreflang: string;
  htmlLang: string;
  name: string;
  nativeName: string;
  ogLocale: string;
  badge: string;
}

export const LOCALE_INFO: Record<Locale, LocaleInfo> = {
  en: {
    code: 'en',
    hreflang: 'en',
    htmlLang: 'en',
    name: 'English',
    nativeName: 'English',
    ogLocale: 'en_US',
    badge: 'EN',
  },
  es: {
    code: 'es',
    hreflang: 'es',
    htmlLang: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    ogLocale: 'es_ES',
    badge: 'ES',
  },
  de: {
    code: 'de',
    hreflang: 'de',
    htmlLang: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    ogLocale: 'de_DE',
    badge: 'DE',
  },
  fr: {
    code: 'fr',
    hreflang: 'fr',
    htmlLang: 'fr',
    name: 'French',
    nativeName: 'Français',
    ogLocale: 'fr_FR',
    badge: 'FR',
  },
  pt: {
    code: 'pt',
    hreflang: 'pt',
    htmlLang: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    ogLocale: 'pt_PT',
    badge: 'PT',
  },
  ja: {
    code: 'ja',
    hreflang: 'ja',
    htmlLang: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    ogLocale: 'ja_JP',
    badge: 'JA',
  },
  'zh-cn': {
    code: 'zh-cn',
    hreflang: 'zh-Hans',
    htmlLang: 'zh-Hans',
    name: 'Chinese (Simplified)',
    nativeName: '简体中文',
    ogLocale: 'zh_CN',
    badge: '简',
  },
  'zh-tw': {
    code: 'zh-tw',
    hreflang: 'zh-Hant',
    htmlLang: 'zh-Hant',
    name: 'Chinese (Traditional)',
    nativeName: '繁體中文',
    ogLocale: 'zh_TW',
    badge: '繁',
  },
  it: {
    code: 'it',
    hreflang: 'it',
    htmlLang: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    ogLocale: 'it_IT',
    badge: 'IT',
  },
  nl: {
    code: 'nl',
    hreflang: 'nl',
    htmlLang: 'nl',
    name: 'Dutch',
    nativeName: 'Nederlands',
    ogLocale: 'nl_NL',
    badge: 'NL',
  },
};

export const isLocale = (val: string): val is Locale => {
  return (LOCALES as readonly string[]).includes(val);
};

export const normalizePath = (path: string): string => {
  let p = path.split('?')[0].split('#')[0];
  if (!p.startsWith('/')) p = `/${p}`;
  if (!p.endsWith('/')) p = `${p}/`;
  return p;
};

/**
 * Returns the locale of a given pathname, defaulting to 'en'.
 */
export const getLocaleFromPath = (pathname: string): Locale => {
  const norm = normalizePath(pathname);
  const segments = norm.split('/').filter(Boolean);
  if (segments.length > 0 && isLocale(segments[0])) {
    return segments[0];
  }
  return DEFAULT_LOCALE;
};

/**
 * Returns the un-localized base path (e.g. '/reaction-time-test/').
 */
export const getBasePath = (pathname: string): string => {
  const norm = normalizePath(pathname);
  const segments = norm.split('/').filter(Boolean);
  if (segments.length > 0 && isLocale(segments[0])) {
    const rest = segments.slice(1).join('/');
    return rest ? `/${rest}/` : '/';
  }
  return norm;
};

/**
 * Given a base path and a target locale, returns the properly prefixed path.
 */
export const getLocalizedPath = (path: string, locale: Locale): string => {
  const basePath = getBasePath(path);
  if (locale === DEFAULT_LOCALE) {
    return basePath;
  }
  return basePath === '/' ? `/${locale}/` : `/${locale}${basePath}`;
};

export interface AlternateLink {
  locale: Locale | 'x-default';
  hreflang: string;
  href: string;
}

/**
 * Generates all canonical alternate and x-default URLs for hreflang tags.
 */
export const getAlternateUrls = (pathname: string, siteUrl = 'https://speedreflex.com'): AlternateLink[] => {
  const basePath = getBasePath(pathname);
  const site = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;

  const links: AlternateLink[] = [];

  // x-default points to the default English URL
  const enPath = getLocalizedPath(basePath, DEFAULT_LOCALE);
  links.push({
    locale: 'x-default',
    hreflang: 'x-default',
    href: `${site}${enPath}`,
  });

  // Then add all 10 locales
  for (const loc of LOCALES) {
    const locPath = getLocalizedPath(basePath, loc);
    links.push({
      locale: loc,
      hreflang: LOCALE_INFO[loc].hreflang,
      href: `${site}${locPath}`,
    });
  }

  return links;
};
