import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
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
        '/login',
        '/join',
        '/level-up/my-quest',
        '/forget-password',
        '/reset-password',
        '/tournaments/*/preferences',
        '/upgrade',
      ],
    },
    sitemap: 'https://tenaceiq.com/sitemap.xml',
    host: 'https://tenaceiq.com',
  }
}
