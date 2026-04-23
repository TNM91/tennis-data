import type { MetadataRoute } from 'next'

const SITE_URL = 'https://tenaceiq.com'

type RouteConfig = {
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  priority: number
}

const routes: RouteConfig[] = [
  { path: '', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/pricing', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/explore', changeFrequency: 'weekly', priority: 0.85 },
  { path: '/explore/players', changeFrequency: 'daily', priority: 0.85 },
  { path: '/explore/teams', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/explore/leagues', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/explore/matchups', changeFrequency: 'weekly', priority: 0.75 },
  { path: '/explore/rankings', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/players', changeFrequency: 'daily', priority: 0.8 },
  { path: '/leagues', changeFrequency: 'weekly', priority: 0.75 },
  { path: '/teams', changeFrequency: 'weekly', priority: 0.75 },
  { path: '/matchup', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/rankings', changeFrequency: 'weekly', priority: 0.75 },
  { path: '/how-it-works', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/methodology', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/advertising-disclosure', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/privacy', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/terms', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/cookies', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/disclaimer', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/data-policy', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/copyright', changeFrequency: 'monthly', priority: 0.3 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }))
}
