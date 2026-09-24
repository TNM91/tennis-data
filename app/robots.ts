import type { MetadataRoute } from 'next'
import { getPlayerSitemapCount } from '@/lib/public-player-sitemaps'

export const revalidate = 86400

export default async function robots(): Promise<MetadataRoute.Robots> {
  const playerSitemapCount = await getPlayerSitemapCount()
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
    sitemap: [
      'https://www.tenaceiq.com/sitemap.xml',
      ...Array.from({ length: playerSitemapCount }, (_, id) => `https://www.tenaceiq.com/players/sitemap/${id}.xml`),
    ],
    host: 'https://www.tenaceiq.com',
  }
}
