import { createClient } from '@supabase/supabase-js'
import { supabaseUrl } from '@/lib/supabase'
import { currentPlayerRefreshUrls } from '@/lib/tennisrecord/current-refresh'
import { summarizePlayerImportFreshness, unknownImportFreshness } from '@/lib/player-import-freshness'
export const runtime = 'nodejs'
export async function GET(request: Request) {
  const playerId = new URL(request.url).searchParams.get('playerId') ?? ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(playerId)) return Response.json({ message: 'Choose a valid player.' }, { status: 400 })
  const reply = (value: typeof unknownImportFreshness) => Response.json(value, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } })
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) return reply(unknownImportFreshness)
  const service = createClient(supabaseUrl, key, { auth: { persistSession: false } })
  try {
    const identities = await service.from('tennisrecord_player_identities').select('status,tennisrecord_staged_players(source_url)').eq('canonical_player_id',playerId).limit(2)
    if (identities.error) throw identities.error
    if (identities.data?.length !== 1 || identities.data[0].status !== 'matched') return reply(unknownImportFreshness)
    const owner = identities.data[0].tennisrecord_staged_players as unknown as { source_url: string } | null
    if (!owner?.source_url) return reply(unknownImportFreshness)
    const urls = currentPlayerRefreshUrls(owner.source_url).filter(u => new URL(u).pathname.toLowerCase().endsWith('/matchhistory.aspx'))
    if (!urls.length) return reply(unknownImportFreshness)
    const pages = await service.from('tennisrecord_crawl_queue').select('status,current_refreshed_at,refresh_due_at').in('source_url',urls).eq('refresh_season',new Date().getUTCFullYear())
    if (pages.error) throw pages.error
    return reply(summarizePlayerImportFreshness(pages.data ?? [],urls.length))
  } catch { return Response.json(unknownImportFreshness, { status: 503, headers: { 'Cache-Control': 'no-store' } }) }
}
