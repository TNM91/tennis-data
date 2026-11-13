import type { SupabaseClient } from '@supabase/supabase-js'
import { nativeTournamentEntryColumns, readTournamentEntryApprovals, tournamentEntryDigest } from './native-tournament-approvals'
import { readTestflightTournament, testflightTournamentId } from './testflight-tournament'

type Publication = Record<string, unknown> & {id:string;event_id:string|null;is_event:boolean;name:string}

export async function loadTournamentEntryPublications(
  db: SupabaseClient,
  ids: string[],
  approvals = readTournamentEntryApprovals(),
  signal = AbortSignal.timeout(12000),
  owner = '',
) {
  const allowed = ids.filter(id => approvals.has(id))
  const demo = owner && ids.includes(testflightTournamentId(owner))
    ? await readTestflightTournament(db, owner, nativeTournamentEntryColumns, signal) as Publication | null : null
  const { data, error } = allowed.length ? await db.from('tiq_tournaments').select(nativeTournamentEntryColumns)
    .in('id', allowed).eq('is_public', true).in('status', ['open', 'scheduled', 'completed']).abortSignal(signal) : { data: [], error: null }
  if (error || !data || data.length > allowed.length) throw Error('Tournament entry details unavailable')
  const publications = new Map<string, Publication>(data.filter(row => allowed.includes(row.id) && row.is_public === true &&
    approvals.get(row.id) === tournamentEntryDigest(row)).map(row => [row.id, row]))
  if (demo) publications.set(demo.id, demo)
  return publications
}
