// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://speedreflex.com',
  trailingSlash: 'always',

  i18n: {
    defaultLocale: 'en',
    locales: [
      'en',
      'es',
      'de',
      'fr',
      'pt',
      'ja',
      { path: 'zh-cn', codes: ['zh-CN', 'zh-Hans'] },
      { path: 'zh-tw', codes: ['zh-TW', 'zh-Hant'] },
      'it',
      'nl',
    ],
    routing: {
      prefixDefaultLocale: false,
    },
  },

  redirects: {
    '/en/': '/',
    '/en/about/': '/about/',
    '/en/audio-reaction-time-test/': '/audio-reaction-time-test/',
    '/en/average-reaction-time/': '/average-reaction-time/',
    '/en/bike-speed-test/': '/bike-speed-test/',
    '/en/bus-speed-test/': '/bus-speed-test/',
    '/en/car-speed-test/': '/car-speed-test/',
    '/en/contact/': '/contact/',
    '/en/f1-reaction-time-test/': '/f1-reaction-time-test/',
    '/en/flight-speed-test/': '/flight-speed-test/',
    '/en/privacy/': '/privacy/',
    '/en/reaction-time-test/': '/reaction-time-test/',
    '/en/speedometer/': '/speedometer/',
    '/en/stopping-distance-calculator/': '/stopping-distance-calculator/',
    '/en/terms/': '/terms/',
    '/en/train-speed-test/': '/train-speed-test/',
  },

  vite: {
    plugins: [
      tailwindcss(),
      {
        name: 'dev-trailing-slash-redirect',
        configureServer(server) {
          return () => {
            server.middlewares.stack.unshift({
              route: '',
              handle(req, res, next) {
                if (req.method !== 'GET' && req.method !== 'HEAD') return next();
                const [rawPath, search] = (req.url || '').split('?');
                if (
                  rawPath &&
                  !rawPath.endsWith('/') &&
                  !rawPath.includes('.') &&
                  !rawPath.startsWith('/@') &&
                  !rawPath.startsWith('/_')
                ) {
                  res.writeHead(307, {
                    Location: `${rawPath}/${search ? `?${search}` : ''}`,
                  });
                  res.end();
                  return;
                }
                next();
              },
            });
          };
        },
      },
    ],
  },

  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404') && !page.includes('/500'),
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en',
          es: 'es',
          de: 'de',
          fr: 'fr',
          pt: 'pt',
          ja: 'ja',
          'zh-cn': 'zh-Hans',
          'zh-tw': 'zh-Hant',
          it: 'it',
          nl: 'nl',
        },
      },
    }),
    {
      name: 'sitemap-xml-sync',
      hooks: {
        'astro:build:done': async ({ dir }) => {
          try {
            const sitemapIndexPath = fileURLToPath(new URL('sitemap-index.xml', dir));
            const sitemapXmlPath = fileURLToPath(new URL('sitemap.xml', dir));
            const publicSitemapXmlPath = fileURLToPath(new URL('./public/sitemap.xml', import.meta.url));
            const publicSitemapIndexPath = fileURLToPath(new URL('./public/sitemap-index.xml', import.meta.url));

            await fs.copyFile(sitemapIndexPath, sitemapXmlPath);
            await fs.copyFile(sitemapIndexPath, publicSitemapXmlPath);
            await fs.copyFile(sitemapIndexPath, publicSitemapIndexPath);
            console.log('[@astrojs/sitemap] `sitemap.xml` generated and synchronized with `sitemap-index.xml`');
          } catch (err) {
            console.error('[sitemap-xml-sync] Error synchronizing sitemap.xml:', err);
          }
        },
      },
    },
  ],

  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Geist',
      cssVariable: '--font-geist',
      weights: [400, 500, 600],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['Arial', 'sans-serif']
    },
    {
      provider: fontProviders.google(),
      name: 'Geist Mono',
      cssVariable: '--font-geist-mono',
      weights: [400, 500],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
    }
  ]
});
