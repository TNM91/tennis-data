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
    const normalizedName = normalizeContactKey(contact.name)
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

  const normalizedTeamName = normalizeContactKey(parsedDraft.rosterTeamName)
  return Array.from(byName.values()).map((contact) => ({
    captain_user_id: input.captainUserId,
    team_name: parsedDraft.rosterTeamName.trim(),
    normalized_team_name: normalizedTeamName,
    league_name: parsedDraft.leagueName.trim(),
    flight: parsedDraft.flight.trim(),
    full_name: contact.name.trim(),
    normalized_name: normalizeContactKey(contact.name),
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

function normalizeContactKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
