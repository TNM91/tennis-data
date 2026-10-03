import type { SupabaseClient } from '@supabase/supabase-js'
import { currentPlayerRefreshUrls } from './current-refresh'

/** Queue ownership only: preserve captures, due dates, active claims and review holds. */
export async function assignMissouriPlayerRefreshPages(
  service: SupabaseClient,
  players: Array<{ source_url: string; state: string | null }>,
  campaignId: string,
  now = new Date(),
) {
  const urls = [...new Set(players.filter(player => player.state === 'MO').flatMap(player => currentPlayerRefreshUrls(player.source_url, now)))]
  for (let offset = 0; offset < urls.length; offset += 50) {
    const { error } = await service.from('tennisrecord_crawl_queue')
      .update({ campaign_id: campaignId })
      .in('source_url', urls.slice(offset, offset + 50))
      .in('status', ['pending', 'done'])
      .or(`campaign_id.is.null,campaign_id.neq.${campaignId}`)
    if (error) throw new Error(error.message)
  }
}
