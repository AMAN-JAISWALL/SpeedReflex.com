import { SITE, toolById, type Tool } from './site';

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

export const website = (): Node => ({
  '@type': 'WebSite',
  '@id': SITE_ID,
  name: SITE.name,
  url: abs('/'),
  description: SITE.description,
  inLanguage: 'en',
  publisher: { '@id': ORG_ID },
});

/** Home › [parent] › page, for any tool; the parent comes from the tool's `parent`. */
export const toolCrumbs = (tool: Tool): Crumb[] => {
  const parent = tool.parent ? toolById(tool.parent) : null;
  return [
    { name: 'Home', href: '/' },
    ...(parent ? [{ name: parent.name, href: parent.href }] : []),
    { name: tool.name, href: tool.href },
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
  type?: 'WebPage' | 'AboutPage' | 'CollectionPage';
}

/** The WebPage node (plus its breadcrumb) that every indexable page gets. */
export const webPage = ({ href, name, description, crumbs, faq, type = 'WebPage' }: PageInput): Node[] => {
  const page: Node = {
    '@type': faq?.length ? [type, 'FAQPage'] : type,
    '@id': pageId(href),
    url: abs(href),
    name,
    description,
    inLanguage: 'en',
    isPartOf: { '@id': SITE_ID },
    ...(crumbs ? { breadcrumb: { '@id': `${abs(href)}#breadcrumb` } } : {}),
    ...(faq?.length
      ? {
          mainEntity: faq.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        }
      : {}),
  };
  return crumbs ? [page, breadcrumbList(crumbs)] : [page];
};

/** A tool page: its WebPage, breadcrumb and the browser app itself. */
export const toolPage = (tool: Tool, title: string, description: string, faq?: FaqItem[]): Node[] => [
  ...webPage({ href: tool.href, name: title, description, crumbs: toolCrumbs(tool), faq }),
  {
    '@type': 'WebApplication',
    '@id': `${abs(tool.href)}#app`,
    name: tool.name,
    url: abs(tool.href),
    description,
    applicationCategory: tool.category === 'reflex' ? 'GameApplication' : 'UtilitiesApplication',
    operatingSystem: 'Any (runs in the browser)',
    browserRequirements:
      tool.category === 'speed' ? 'Requires JavaScript and location access; needs a device with GPS.' : 'Requires JavaScript.',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@id': ORG_ID },
    mainEntityOfPage: { '@id': pageId(tool.href) },
  },
];

interface ArticleInput {
  href: string;
  headline: string;
  description: string;
  datePublished: string;
  dateModified: string;
  crumbs: Crumb[];
  faq?: FaqItem[];
}

/** A guide: WebPage + breadcrumb + Article written and published by SpeedReflex. */
export const articlePage = ({ href, headline, description, datePublished, dateModified, crumbs, faq }: ArticleInput): Node[] => [
  ...webPage({ href, name: headline, description, crumbs, faq }),
  {
    '@type': 'Article',
    '@id': `${abs(href)}#article`,
    headline,
    description,
    datePublished,
    dateModified,
    inLanguage: 'en',
    image: abs('/og.png'),
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    mainEntityOfPage: { '@id': pageId(href) },
  },
];
