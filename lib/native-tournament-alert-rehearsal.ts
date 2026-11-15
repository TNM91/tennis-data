import type { SupabaseClient } from '@supabase/supabase-js'
import { nativeTournamentPublicationId } from './native-tournament-draft-contract'

const rehearsalKey = '74697166-6c74-4e10-8f11-'

export function nativeTournamentRehearsalEventId(parent: string) {
  return nativeTournamentPublicationId(parent, 'event') && parent.startsWith('tiq-native-event-' + rehearsalKey)
}

export function nativeTournamentAlertRehearsalSelection(parent: string, division: string) {
  return nativeTournamentRehearsalEventId(parent) &&
    nativeTournamentPublicationId(division, 'division') && division.startsWith('tiq-native-division-' + rehearsalKey)
}

export async function readNativeTournamentAlertRehearsal(
  db: SupabaseClient, parent: string, division: string, view: 'draw' | 'entry' | 'walkthrough',
) {
  const { data, error } = await db.rpc('native_tournament_alert_rehearsal', {
    p_parent: parent, p_division: division, p_view: view,
  }).abortSignal(AbortSignal.timeout(12000)).retry(false)
  if (error) throw Error('Private tournament rehearsal unavailable')
  return data
}
