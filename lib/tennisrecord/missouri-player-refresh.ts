import type { SupabaseClient } from '@supabase/supabase-js'
import { currentPlayerRefreshUrls } from './current-refresh'

/** Enroll a newly parsed Missouri profile immediately, even from a national crawl. */
export async function enrollDiscoveredMissouriPlayers(
  service: SupabaseClient,
  players: Array<{ sourceUrl: string; state: string }>,
  enqueue: (urls: string[], campaignId: string) => Promise<number>,
  now = new Date(),
) {
  const owners = players.filter(player => player.state === 'MO' && currentPlayerRefreshUrls(player.sourceUrl, now).length)
    .map(player => ({ source_url: player.sourceUrl, state: player.state }))
  if (!owners.length) return 0
  const campaign = await service.from('tennisrecord_campaigns').select('id').eq('slug', 'missouri-2025-current').maybeSingle()
  if (campaign.error) throw new Error(campaign.error.message)
  if (!campaign.data) return 0
  const urls = [...new Set(owners.flatMap(player => currentPlayerRefreshUrls(player.source_url, now)))]
  const queued = await enqueue(urls, campaign.data.id)
  await assignMissouriPlayerRefreshPages(service, owners, campaign.data.id, now)
  const season = now.getUTCFullYear()
  for (let offset = 0; offset < urls.length; offset += 50) {
    const saved = await service.from('tennisrecord_crawl_queue')
      .update({ refresh_season: season, refresh_due_at: now.toISOString() })
      .in('source_url', urls.slice(offset, offset + 50))
      .in('status', ['pending', 'done'])
      .or(`refresh_season.is.null,refresh_season.neq.${season}`)
    if (saved.error) throw new Error(saved.error.message)
  }
  return queued
}

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
