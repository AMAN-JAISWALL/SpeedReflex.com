import { SITE, toolById, type Tool } from './site';
import { LOCALE_INFO, getLocalizedPath, type Locale } from './i18n';

// Every page emits one JSON-LD @graph (see BaseLayout). Nodes reference each other by @id, so the
// organization and website are described once and each page's WebPage links back to them.

export interface FaqItem {
  q: string;
  a: string;
}

export interface Crumb {
  name: string;
  href: string;
}

type Node = Record<string, unknown>;

const abs = (path: string) => new URL(path, SITE.url).href;
const ORG_ID = `${SITE.url}/#organization`;
const SITE_ID = `${SITE.url}/#website`;
const pageId = (href: string) => `${abs(href)}#webpage`;

export const organization = (): Node => ({
  '@type': 'Organization',
  '@id': ORG_ID,
  name: SITE.name,
  url: abs('/'),
  logo: { '@type': 'ImageObject', url: abs('/web-app-manifest-512x512.png'), width: 512, height: 512 },
  email: SITE.email,
});

export const website = (locale: Locale = 'en'): Node => ({
  '@type': 'WebSite',
  '@id': SITE_ID,
  name: SITE.name,
  url: abs('/'),
  description: SITE.description,
  inLanguage: LOCALE_INFO[locale]?.htmlLang ?? 'en',
  publisher: { '@id': ORG_ID },
});

/** Home › [parent] › page, for any tool; the parent comes from the tool's `parent`. */
export const toolCrumbs = (
  tool: Tool,
  locale: Locale = 'en',
  labels?: { home?: string; parent?: string; tool?: string },
): Crumb[] => {
  const parent = tool.parent ? toolById(tool.parent) : null;
  return [
    { name: labels?.home ?? 'Home', href: getLocalizedPath('/', locale) },
    ...(parent
      ? [{ name: labels?.parent ?? parent.name, href: getLocalizedPath(parent.href, locale) }]
      : []),
    { name: labels?.tool ?? tool.name, href: getLocalizedPath(tool.href, locale) },
  ];
};

const breadcrumbList = (crumbs: Crumb[]): Node => ({
  '@type': 'BreadcrumbList',
  '@id': `${abs(crumbs[crumbs.length - 1].href)}#breadcrumb`,
  itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: abs(c.href) })),
});

interface PageInput {
  href: string;
  name: string;
  description: string;
  crumbs?: Crumb[];
  /** Only for pages that show these questions and answers on screen. */
  faq?: FaqItem[];
  type?: 'WebPage' | 'AboutPage' | 'CollectionPage' | 'ContactPage';
  locale?: Locale;
}

/** The WebPage node (plus its breadcrumb) that every indexable page gets. */
export const webPage = ({ href, name, description, crumbs, faq, type = 'WebPage', locale = 'en' }: PageInput): Node[] => {
  const lang = LOCALE_INFO[locale]?.htmlLang ?? 'en';
  const page: Node = {
    '@type': type,
    '@id': pageId(href),
    url: abs(href),
    name,
    description,
    inLanguage: lang,
    isPartOf: { '@id': SITE_ID },
    ...(crumbs ? { breadcrumb: { '@id': `${abs(href)}#breadcrumb` } } : {}),
  };
  const nodes: Node[] = [page];
  if (crumbs) nodes.push(breadcrumbList(crumbs));
  if (faq?.length) {
    nodes.push({
      '@type': 'FAQPage',
      '@id': `${abs(href)}#faq`,
      url: abs(href),
      name: `${name} — Frequently Asked Questions`,
      isPartOf: { '@id': pageId(href) },
      mainEntity: faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }
  return nodes;
};

/** A tool page: its WebPage, breadcrumb and the browser app itself. */
export const toolPage = (
  tool: Tool,
  title: string,
  description: string,
  faq?: FaqItem[],
  locale: Locale = 'en',
  localizedHref?: string,
  crumbs?: Crumb[],
): Node[] => {
  const href = localizedHref ?? tool.href;
  const lang = LOCALE_INFO[locale]?.htmlLang ?? 'en';
  return [
    ...webPage({ href, name: title, description, crumbs: crumbs ?? toolCrumbs(tool), faq, locale }),
    {
      '@type': 'WebApplication',
      '@id': `${abs(href)}#app`,
      name: title,
      url: abs(href),
      description,
      inLanguage: lang,
      applicationCategory: tool.category === 'reflex' ? 'GameApplication' : 'UtilitiesApplication',
      operatingSystem: 'Any (runs in the browser)',
      browserRequirements:
        tool.category === 'speed' ? 'Requires JavaScript and location access; needs a device with GPS.' : 'Requires JavaScript.',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@id': ORG_ID },
      mainEntityOfPage: { '@id': pageId(href) },
    },
  ];
};

interface ArticleInput {
  href: string;
  headline: string;
  description: string;
  datePublished: string;
  dateModified: string;
  crumbs: Crumb[];
  faq?: FaqItem[];
  locale?: Locale;
}

/** A guide: WebPage + breadcrumb + Article written and published by SpeedReflex. */
export const articlePage = ({ href, headline, description, datePublished, dateModified, crumbs, faq, locale = 'en' }: ArticleInput): Node[] => {
  const lang = LOCALE_INFO[locale]?.htmlLang ?? 'en';
  return [
    ...webPage({ href, name: headline, description, crumbs, faq, locale }),
    {
      '@type': 'Article',
      '@id': `${abs(href)}#article`,
      headline,
      description,
      datePublished,
      dateModified,
      inLanguage: lang,
      image: abs('/og.png'),
      author: { '@id': ORG_ID },
      publisher: { '@id': ORG_ID },
      mainEntityOfPage: { '@id': pageId(href) },
    },
  ];
};
