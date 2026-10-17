import type { MetadataRoute } from 'next'
import { PLAYER_DEVELOPMENT_IDENTITIES } from '@/lib/player-development'
import { TENNIS_GUIDES } from '@/lib/tennis-guides'
import { getPublicPlayerDiscovery } from '@/lib/public-player-evidence-server'
import { getPublicTeamDiscovery } from '@/lib/public-competition-evidence-server'
import { buildTeamProfileHref } from '@/lib/team-routes'

export const revalidate = 86400

const SITE_URL = 'https://www.tenaceiq.com'

type RouteConfig = {
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  priority: number
}

const routes: RouteConfig[] = [
  { path: '', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/pricing', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/explore', changeFrequency: 'weekly', priority: 0.85 },
  { path: '/player-development', changeFrequency: 'monthly', priority: 0.84 },
  { path: '/compete', changeFrequency: 'weekly', priority: 0.84 },
  { path: '/manage', changeFrequency: 'weekly', priority: 0.84 },
  { path: '/coaches', changeFrequency: 'weekly', priority: 0.82 },
  { path: '/leagues-and-tournaments', changeFrequency: 'weekly', priority: 0.82 },
  { path: '/tournaments', changeFrequency: 'weekly', priority: 0.82 },
  { path: '/resources', changeFrequency: 'weekly', priority: 0.78 },
  { path: '/resources/platform-tour', changeFrequency: 'monthly', priority: 0.74 },
  { path: '/resources/usta-upload', changeFrequency: 'monthly', priority: 0.68 },
  { path: '/matchup', changeFrequency: 'weekly', priority: 0.82 },
  { path: '/level-up', changeFrequency: 'weekly', priority: 0.82 },
  { path: '/explore/search', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/player-development/workbook', changeFrequency: 'monthly', priority: 0.62 },
  { path: '/player-development/coach-planner', changeFrequency: 'monthly', priority: 0.62 },
  { path: '/explore/players', changeFrequency: 'daily', priority: 0.85 },
  { path: '/explore/teams', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/explore/leagues', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/explore/rankings', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/players', changeFrequency: 'daily', priority: 0.8 },
  { path: '/leagues', changeFrequency: 'weekly', priority: 0.75 },
  { path: '/teams', changeFrequency: 'weekly', priority: 0.75 },
  { path: '/rankings', changeFrequency: 'weekly', priority: 0.75 },
  { path: '/how-it-works', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/methodology', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/advertising-disclosure', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/privacy', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/terms', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/billing', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/cookies', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/disclaimer', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/data-policy', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/legal/copyright', changeFrequency: 'monthly', priority: 0.3 },
]

const playerDevelopmentRoutes: RouteConfig[] = PLAYER_DEVELOPMENT_IDENTITIES.flatMap((identity) => [
  { path: `/level-up/${identity.slug}`, changeFrequency: 'weekly', priority: 0.72 },
  { path: `/player-development/${identity.slug}`, changeFrequency: 'monthly', priority: 0.58 },
  { path: `/player-development/${identity.slug}/level-up`, changeFrequency: 'weekly', priority: 0.72 },
  { path: `/player-development/${identity.slug}/workbook`, changeFrequency: 'monthly', priority: 0.52 },
  { path: `/player-development/${identity.slug}/coach-planner`, changeFrequency: 'monthly', priority: 0.52 },
])

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [players, teams] = await Promise.all([getPublicPlayerDiscovery(), getPublicTeamDiscovery()])
  const entries: MetadataRoute.Sitemap = [...routes, ...playerDevelopmentRoutes].map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,

    changeFrequency,
    priority,
  })).concat(TENNIS_GUIDES.map((guide) => ({
    url: `${SITE_URL}/resources/guides/${guide.slug}`,
    lastModified: new Date(guide.published),
    changeFrequency: 'monthly' as const,
    priority: 0.75,
  })))
  // A match date is evidence freshness, not a reliable page-edit timestamp.
  return [...entries, ...players.map(({ player }) => ({
    url: `${SITE_URL}/players/${player.id}`,
    changeFrequency: 'daily' as const,
    priority: 0.7,
  })), ...teams.map(({ name }) => ({
    url: `${SITE_URL}${buildTeamProfileHref(name)}`,
    changeFrequency: 'daily' as const,
    priority: 0.65,
  }))]
}
