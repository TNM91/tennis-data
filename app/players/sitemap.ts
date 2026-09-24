import type { MetadataRoute } from 'next'
import { getPlayerSitemapCount, getPlayerSitemapIds } from '@/lib/public-player-sitemaps'

export const revalidate = 86400

export async function generateSitemaps() {
  const count = await getPlayerSitemapCount()
  return Array.from({ length: count }, (_, id) => ({ id }))
}

export default async function sitemap({ id }: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const sitemapId = Number(await id)
  if (!Number.isInteger(sitemapId) || sitemapId < 0) return []

  const playerIds = await getPlayerSitemapIds(sitemapId)
  return playerIds.map((playerId) => ({
    url: `https://www.tenaceiq.com/players/${encodeURIComponent(playerId)}`,
  }))
}
