import type { SupabaseClient } from '@supabase/supabase-js'
import { courtAccountId } from './native-court-result-contract'

export function testflightLeagueScoreId(owner: string) {
  return courtAccountId(owner) ? 'tiq-testflight-scores-' + owner.toLowerCase() : ''
}

export async function readTestflightScoreLeague(db: SupabaseClient, owner: string, columns: string) {
  const id = testflightLeagueScoreId(owner)
  if (!id) return null
  const { data, error } = await db.from('tiq_leagues').select(columns).eq('id', id)
    .eq('created_by_user_id', owner).eq('is_public', false).eq('league_format', 'team')
    .eq('season_status', 'active').abortSignal(AbortSignal.timeout(12000)).maybeSingle()
  if (error) throw Error('TestFlight league unavailable')
  const row = data as Record<string,unknown> | null
  if (!row) return null
  if (row.id !== id || row.created_by_user_id !== owner || row.is_public !== false ||
      row.league_format !== 'team' || row.season_status !== 'active') throw Error('TestFlight league changed')
  return row
}
