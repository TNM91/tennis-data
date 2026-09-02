import { waitUntil } from '@vercel/functions'
import type { SupabaseClient } from '@supabase/supabase-js'
import { recalculateDynamicRatings } from './recalculateRatings'

/**
 * Scorecard confirmation should never make a player wait for the full rating
 * rebuild. Keep the durable import in the request, then refresh ratings after
 * the response. Snapshot replacement stays off because several confirmations
 * can finish close together.
 */
export function scheduleDataAssistRatingRefresh(supabase: SupabaseClient) {
  waitUntil(
    recalculateDynamicRatings(undefined, supabase, { replaceSnapshots: false }).catch((error) => {
      console.error('Data Assist rating refresh failed after scorecard import', error)
    }),
  )
}
