import type { SupabaseClient } from '@supabase/supabase-js'
import { nativeTournamentPublicationId } from './native-tournament-draft-contract'

const rehearsalKey = '74697166-6c74-4e10-8f11-'

export function nativeTournamentRehearsalEventId(parent: string) {
  return nativeTournamentPublicationId(parent, 'event') && parent.startsWith('tiq-native-event-' + rehearsalKey)
}

export function nativeTournamentRehearsalDivisionId(division: string) {
  return nativeTournamentPublicationId(division, 'division') && division.startsWith('tiq-native-division-' + rehearsalKey)
}

export function nativeTournamentAlertRehearsalSelection(parent: string, division: string) {
  return nativeTournamentRehearsalEventId(parent) && nativeTournamentRehearsalDivisionId(division)
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

export async function readNativeTournamentWalkthroughEntryNames(
  db: SupabaseClient, owner: string, divisions: string[], signal: AbortSignal,
) {
  const names = new Map<string, {eventName: string; divisionName: string; selection: {parent: string; division: string}}>()
  if (!divisions.length) return names
  const { data, error } = await db.rpc('native_tournament_walkthrough_entry_names', { p_divisions: divisions })
    .abortSignal(signal).retry(false)
  if (error?.code === 'PGRST202') return names
  if (error || data?.owner !== owner || !Array.isArray(data.entries) || data.entries.length > divisions.length) {
    throw Error('Private tournament entries unavailable')
  }
  for (const row of data.entries) {
    if (!row || typeof row.parent !== 'string' || typeof row.division !== 'string' ||
        !nativeTournamentAlertRehearsalSelection(row.parent, row.division) ||
        !divisions.includes(row.division) || names.has(row.division) ||
        typeof row.eventName !== 'string' || typeof row.divisionName !== 'string') {
      throw Error('Private tournament entry scope changed')
    }
    names.set(row.division, {
      eventName: row.eventName, divisionName: row.divisionName,
      selection: { parent: row.parent, division: row.division },
    })
  }
  return names
}
