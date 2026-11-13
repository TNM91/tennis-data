import type { SupabaseClient } from '@supabase/supabase-js'
import { nativeTournamentEntryColumns, readTournamentEntryApprovals, tournamentEntryDigest } from './native-tournament-approvals'

export async function loadTournamentEntryPublications(
  db: SupabaseClient,
  ids: string[],
  approvals = readTournamentEntryApprovals(),
  signal = AbortSignal.timeout(12000),
) {
  const allowed = ids.filter(id => approvals.has(id))
  type Publication = Record<string, unknown> & {id:string;event_id:string|null;is_event:boolean;name:string}
  if (!allowed.length) return new Map<string, Publication>()
  const { data, error } = await db.from('tiq_tournaments').select(nativeTournamentEntryColumns)
    .in('id', allowed).eq('is_public', true).in('status', ['open', 'scheduled', 'completed']).abortSignal(signal)
  if (error || !data || data.length > allowed.length) throw Error('Tournament entry details unavailable')
  return new Map<string, Publication>(data.filter(row => allowed.includes(row.id) && row.is_public === true &&
    approvals.get(row.id) === tournamentEntryDigest(row)).map(row => [row.id, row]))
}
