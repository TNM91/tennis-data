import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DataAssistTeamSummaryParsedContact,
  DataAssistTeamSummaryParsedDraft,
} from './data-assist-team-summary-parser'

export const CAPTAIN_ROSTER_CONTACTS_TABLE = 'captain_roster_contacts'

export type CaptainRosterContactRow = {
  id?: string
  captain_user_id: string
  team_name: string
  normalized_team_name: string
  league_name: string
  flight: string
  full_name: string
  normalized_name: string
  phone: string
  email: string
  role: string
  is_captain: boolean
  source: string
  source_batch_id: string | null
}

type CaptainContactScopeRow = {
  team_name?: string | null
  league_name?: string | null
  flight?: string | null
  full_name?: string | null
  phone?: string | null
}

export function normalizeCaptainRosterContactKey(value: string | null | undefined) {
  return (value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function selectCaptainContactRowsForScope<T extends CaptainContactScopeRow>(input: {
  rows: T[]
  team: string
  league?: string
  flight?: string
}) {
  const teamKey = normalizeCaptainRosterContactKey(input.team)
  const teamRows = input.rows.filter((row) => (
    !teamKey || normalizeCaptainRosterContactKey(row.team_name) === teamKey
  ))
  if (!teamRows.length) return []

  const leagueKey = normalizeCaptainRosterContactKey(input.league)
  const flightKey = normalizeCaptainRosterContactKey(input.flight)
  const exactScopeRows = teamRows.filter((row) => {
    const leagueMatches = !leagueKey || normalizeCaptainRosterContactKey(row.league_name) === leagueKey
    const flightMatches = !flightKey || normalizeCaptainRosterContactKey(row.flight) === flightKey
    return leagueMatches && flightMatches
  })

  return exactScopeRows.length ? exactScopeRows : teamRows
}

export function getCaptainRosterPhoneCoverage(input: {
  rosterNames: string[]
  contacts: CaptainContactScopeRow[]
}) {
  const phoneNameKeys = new Set(
    input.contacts
      .filter((contact) => Boolean((contact.phone || '').replace(/\D/g, '')))
      .map((contact) => normalizeCaptainRosterContactKey(contact.full_name))
      .filter(Boolean),
  )
  const missingNames = input.rosterNames.filter(
    (name) => !phoneNameKeys.has(normalizeCaptainRosterContactKey(name)),
  )
  return {
    readyCount: Math.max(0, input.rosterNames.length - missingNames.length),
    missingCount: missingNames.length,
    missingNames,
  }
}

export function buildCaptainContactReviewHref(input: {
  baseHref: string
  missingNames: string[]
}) {
  const [pathnameWithQuery, hash = ''] = input.baseHref.split('#', 2)
  const [pathname, existingQuery = ''] = pathnameWithQuery.split('?', 2)
  const params = new URLSearchParams(existingQuery)
  params.set('contactView', input.missingNames.length ? 'missing' : 'all')
  if (input.missingNames.length) params.set('missingContacts', input.missingNames.join('|'))
  else params.delete('missingContacts')
  const query = params.toString()
  return `${pathname}${query ? `?${query}` : ''}#${hash || 'captain-contact-manager'}`
}

type RosterMembershipRow = { id: string; player_name: string | null }
type StoredCaptainContactRow = { id: string; normalized_name: string | null }

export async function syncAuthoritativeCaptainRoster(input: {
  supabase: SupabaseClient
  parsedDraft: DataAssistTeamSummaryParsedDraft
  captainUserId: string
}) {
  if (input.parsedDraft.rosterSource !== 'player_roster') {
    return { removedRosterCount: 0, removedContactCount: 0 }
  }

  const desiredRosterNames = new Set(
    input.parsedDraft.players.map((player) => normalizeCaptainRosterContactKey(player.name)).filter(Boolean),
  )
  const rosterQuery = await input.supabase
    .from('team_roster_members')
    .select('id, player_name')
    .eq('normalized_team_name', input.parsedDraft.rosterTeamName.trim().toLowerCase())
    .eq('league_name', input.parsedDraft.leagueName.trim())
    .eq('flight', input.parsedDraft.flight.trim())
  if (rosterQuery.error) throw new Error(`Current roster could not be checked: ${rosterQuery.error.message}`)

  const staleRosterIds = ((rosterQuery.data || []) as RosterMembershipRow[])
    .filter((row) => !desiredRosterNames.has(normalizeCaptainRosterContactKey(row.player_name)))
    .map((row) => row.id)
  if (staleRosterIds.length) {
    const { error } = await input.supabase.from('team_roster_members').delete().in('id', staleRosterIds)
    if (error) throw new Error(`Old roster players could not be removed: ${error.message}`)
  }

  const desiredContactNames = new Set(
    buildCaptainRosterContactRows(input).map((row) => row.normalized_name),
  )
  const contactQuery = await input.supabase
    .from(CAPTAIN_ROSTER_CONTACTS_TABLE)
    .select('id, normalized_name')
    .eq('captain_user_id', input.captainUserId)
    .eq('normalized_team_name', normalizeCaptainRosterContactKey(input.parsedDraft.rosterTeamName))
    .eq('league_name', input.parsedDraft.leagueName.trim())
    .eq('flight', input.parsedDraft.flight.trim())
  if (contactQuery.error) throw new Error(`Current roster contacts could not be checked: ${contactQuery.error.message}`)

  const staleContactIds = ((contactQuery.data || []) as StoredCaptainContactRow[])
    .filter((row) => !desiredContactNames.has(normalizeCaptainRosterContactKey(row.normalized_name)))
    .map((row) => row.id)
  if (staleContactIds.length) {
    const { error } = await input.supabase.from(CAPTAIN_ROSTER_CONTACTS_TABLE).delete().in('id', staleContactIds)
    if (error) throw new Error(`Old roster contacts could not be removed: ${error.message}`)
  }

  return {
    removedRosterCount: staleRosterIds.length,
    removedContactCount: staleContactIds.length,
  }
}

export function buildCaptainRosterContactRows(input: {
  parsedDraft: DataAssistTeamSummaryParsedDraft
  captainUserId: string
  batchId?: string | null
}): CaptainRosterContactRow[] {
  const { parsedDraft } = input
  const sourceContacts = parsedDraft.contacts?.length
    ? parsedDraft.contacts
    : parsedDraft.players.map<DataAssistTeamSummaryParsedContact>((player) => ({
        name: player.name,
        phone: player.phone || '',
        email: player.email || '',
        role: 'Player',
        isCaptain: false,
      }))
  const byName = new Map<string, DataAssistTeamSummaryParsedContact>()

  for (const contact of sourceContacts) {
    const normalizedName = normalizeCaptainRosterContactKey(contact.name)
    if (!normalizedName || (!contact.phone && !contact.email)) continue
    const existing = byName.get(normalizedName)
    byName.set(normalizedName, {
      ...contact,
      phone: contact.phone || existing?.phone || '',
      email: contact.email || existing?.email || '',
      role: contact.isCaptain ? contact.role : existing?.role || contact.role,
      isCaptain: contact.isCaptain || existing?.isCaptain || false,
    })
  }

  const normalizedTeamName = normalizeCaptainRosterContactKey(parsedDraft.rosterTeamName)
  return Array.from(byName.values()).map((contact) => ({
    captain_user_id: input.captainUserId,
    team_name: parsedDraft.rosterTeamName.trim(),
    normalized_team_name: normalizedTeamName,
    league_name: parsedDraft.leagueName.trim(),
    flight: parsedDraft.flight.trim(),
    full_name: contact.name.trim(),
    normalized_name: normalizeCaptainRosterContactKey(contact.name),
    phone: contact.phone.trim(),
    email: contact.email.trim().toLowerCase(),
    role: contact.role,
    is_captain: contact.isCaptain,
    source: 'tennislink_player_roster',
    source_batch_id: input.batchId || null,
  }))
}

export async function upsertCaptainRosterContacts(input: {
  supabase: SupabaseClient
  parsedDraft: DataAssistTeamSummaryParsedDraft
  captainUserId: string
  batchId?: string | null
}) {
  const rows = buildCaptainRosterContactRows(input)
  if (!rows.length) return 0

  const { error } = await input.supabase
    .from(CAPTAIN_ROSTER_CONTACTS_TABLE)
    .upsert(rows, {
      onConflict: 'captain_user_id,normalized_team_name,normalized_name,league_name,flight',
    })
  if (error) throw new Error(`Roster contacts could not be saved: ${error.message}`)
  return rows.length
}
