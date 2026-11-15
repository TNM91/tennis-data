import type { SupabaseClient } from '@supabase/supabase-js'
import { nativeLeaguePublicationId } from './native-league-publication'

export function nativeLeagueEntryRehearsalId(value: unknown): value is string {
  return nativeLeaguePublicationId(value) && value.startsWith('tiq-native-league-e79ec308-8b38-4bf8-aac9-')
}

export async function readNativeLeagueEntryRehearsal(db: SupabaseClient, owner: string, id: string | null) {
  const { data, error } = await db.rpc('native_league_entry_rehearsal', { p_league: id })
    .abortSignal(AbortSignal.timeout(5000)).retry(false)
  if (error) throw Error('League rehearsal unavailable')
  if (data === null) return null
  if (!data || data.created_by_user_id !== owner || !nativeLeagueEntryRehearsalId(data.id) ||
      (id !== null && data.id !== id) || data.is_public !== false ||
      data.league_format !== 'individual' || data.season_status !== 'active') throw Error('League rehearsal changed')
  return data as Record<string, unknown>
}
