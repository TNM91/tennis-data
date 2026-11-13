import type { SupabaseClient } from '@supabase/supabase-js'

export function testflightTournamentId(owner: string) {
  return `tiq-testflight-doubles-${owner}`
}

export async function readTestflightTournament(
  db: SupabaseClient,
  owner: string,
  columns: string,
  signal: AbortSignal,
) {
  const id = testflightTournamentId(owner)
  const { data, error } = await db.from('tiq_tournaments')
    .select(columns + ',created_by_user_id')
    .eq('id', id).eq('created_by_user_id', owner).eq('is_public', false)
    .eq('is_event', false).is('event_id', null)
    .eq('format', 'round_robin').eq('entrant_type', 'teams')
    .in('status', ['open', 'scheduled', 'completed'])
    .abortSignal(signal).maybeSingle()
  if (error) throw Error('TestFlight tournament unavailable')
  if (!data) return null

  const row = data as unknown as Record<string, unknown>
  if (row.id !== id || row.created_by_user_id !== owner || row.is_public !== false ||
      row.is_event !== false || row.event_id !== null || row.format !== 'round_robin' ||
      row.entrant_type !== 'teams') throw Error('TestFlight tournament changed')
  delete row.created_by_user_id
  return row
}
