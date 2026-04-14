import type { MetadataRoute } from 'next'

const SITE_URL = 'https://tenaceiq.com'

const staticRoutes = [
  '',
  '/about',
  '/advertising-disclosure',
  '/contact',
  '/explore',
  '/faq',
  '/how-it-works',
  '/matchup',
  '/methodology',
  '/players',
  '/rankings',
  '/teams',
  '/leagues',
  '/legal/privacy',
  '/legal/terms',
  '/legal/cookies',
  '/legal/disclaimer',
  '/legal/data-policy',
  '/legal/copyright',
]

export default function sitemap(): MetadataRoute.Sitemap {
  return staticRoutes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : route.startsWith('/legal/') ? 0.4 : 0.7,
  }))
}
