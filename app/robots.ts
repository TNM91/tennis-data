import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/captain/',
        '/coach/',
        '/league-coordinator/',
        '/messages',
        '/mylab',
        '/profile',
        '/preview-home',
        '/tactics',
        '/api/',
        '/data-assist',
        '/login',
        '/join',
        '/level-up/my-quest',
        '/forget-password',
        '/reset-password',
        '/tournaments/*/preferences',
        '/upgrade',
      ],
    }, {
      // The training crawler generated most measured profile traffic. Search
      // crawlers retain the public rules above; no member functionality changes.
      userAgent: 'GPTBot',
      disallow: '/',
    }],
    sitemap: 'https://www.tenaceiq.com/sitemap.xml',
    host: 'https://www.tenaceiq.com',
  }
}
