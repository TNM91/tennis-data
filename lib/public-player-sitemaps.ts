import { getMetadataSupabase } from '@/lib/route-metadata'

export const PLAYER_SITEMAP_SIZE = 5000
const QUERY_PAGE_SIZE = 1000

export async function getPlayerSitemapCount(): Promise<number> {
  const { count, error } = await getMetadataSupabase()
    .from('players')
    .select('id', { count: 'exact', head: true })
    .not('name', 'is', null)
    .neq('name', '')

  if (error) throw new Error(`Unable to count public players: ${error.message}`)
  return Math.ceil((count ?? 0) / PLAYER_SITEMAP_SIZE)
}

export async function getPlayerSitemapIds(sitemapId: number): Promise<string[]> {
  const ids: string[] = []
  const first = sitemapId * PLAYER_SITEMAP_SIZE

  for (let offset = 0; offset < PLAYER_SITEMAP_SIZE; offset += QUERY_PAGE_SIZE) {
    const { data, error } = await getMetadataSupabase()
      .from('players')
      .select('id')
      .not('name', 'is', null)
      .neq('name', '')
      .order('id')
      .range(first + offset, first + offset + QUERY_PAGE_SIZE - 1)

    if (error) throw new Error(`Unable to load public players: ${error.message}`)
    const page = (data ?? []) as Array<{ id: string }>
    ids.push(...page.map((player) => player.id))
    if (page.length < QUERY_PAGE_SIZE) break
  }

  return ids
}
