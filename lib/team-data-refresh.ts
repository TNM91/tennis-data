import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataAssistTeamSummaryParsedDraft } from './data-assist-team-summary-parser'
import { normalizeCaptainRosterContactKey } from './captain-roster-contacts'

type ExistingRosterRow = {
  player_name?: string | null
  ntrp?: number | null
}

type ExistingContactRow = {
  full_name?: string | null
  phone?: string | null
  email?: string | null
}

export type TeamDataRefreshComparison = {
  existingPlayerCount: number
  incomingPlayerCount: number
  addedPlayerNames: string[]
  preservedPlayerNames: string[]
  existingDetailCount: number
  incomingDetailCount: number
  preservedDetailCount: number
  needsConfirmation: boolean
  summary: string
}

export async function analyzeTeamDataRefresh(input: {
  supabase: SupabaseClient
  parsedDraft: DataAssistTeamSummaryParsedDraft
  captainUserId: string
}): Promise<TeamDataRefreshComparison> {
  const { parsedDraft } = input
  const rosterQuery = input.supabase
    .from('team_roster_members')
    .select('player_name,ntrp')
    .eq('normalized_team_name', normalizeRosterTeamKey(parsedDraft.rosterTeamName))
    .eq('league_name', parsedDraft.leagueName.trim())
    .eq('flight', parsedDraft.flight.trim())

  const contactQuery = parsedDraft.rosterSource === 'player_roster'
    ? input.supabase
        .from('captain_roster_contacts')
        .select('full_name,phone,email')
        .eq('captain_user_id', input.captainUserId)
        .eq('normalized_team_name', normalizeCaptainRosterContactKey(parsedDraft.rosterTeamName))
        .eq('league_name', parsedDraft.leagueName.trim())
        .eq('flight', parsedDraft.flight.trim())
    : Promise.resolve({ data: [], error: null })

  const [rosterResult, contactResult] = await Promise.all([rosterQuery, contactQuery])
  if (rosterResult.error) throw new Error(`Current team roster could not be compared: ${rosterResult.error.message}`)
  if (contactResult.error) throw new Error(`Current team contacts could not be compared: ${contactResult.error.message}`)

  return compareTeamDataRefresh({
    parsedDraft,
    existingRoster: (rosterResult.data || []) as ExistingRosterRow[],
    existingContacts: (contactResult.data || []) as ExistingContactRow[],
  })
}

export function compareTeamDataRefresh(input: {
  parsedDraft: DataAssistTeamSummaryParsedDraft
  existingRoster: ExistingRosterRow[]
  existingContacts: ExistingContactRow[]
}): TeamDataRefreshComparison {
  const existingPlayers = namesByKey(input.existingRoster.map((row) => row.player_name || ''))
  const incomingPlayers = namesByKey(input.parsedDraft.players.map((player) => player.name))
  const addedPlayerNames = Array.from(incomingPlayers.entries())
    .filter(([key]) => !existingPlayers.has(key))
    .map(([, name]) => name)
  const preservedPlayerNames = Array.from(existingPlayers.entries())
    .filter(([key]) => !incomingPlayers.has(key))
    .map(([, name]) => name)

  const existingDetailCount = input.parsedDraft.rosterSource === 'player_roster'
    ? countContactDetails(input.existingContacts)
    : input.existingRoster.filter((row) => row.ntrp !== null && row.ntrp !== undefined).length
  const incomingDetailCount = input.parsedDraft.rosterSource === 'player_roster'
    ? countContactDetails(input.parsedDraft.contacts)
    : input.parsedDraft.players.filter((player) => player.ntrp !== null).length
  const preservedDetailCount = input.parsedDraft.rosterSource === 'player_roster'
    ? countPreservedContactDetails(input.existingContacts, input.parsedDraft.contacts)
    : 0
  const needsConfirmation = existingPlayers.size > 0 && (
    preservedPlayerNames.length > 0
    || incomingDetailCount < existingDetailCount
    || preservedDetailCount > 0
  )

  return {
    existingPlayerCount: existingPlayers.size,
    incomingPlayerCount: incomingPlayers.size,
    addedPlayerNames,
    preservedPlayerNames,
    existingDetailCount,
    incomingDetailCount,
    preservedDetailCount,
    needsConfirmation,
    summary: buildRefreshSummary({
      source: input.parsedDraft.rosterSource,
      existingPlayerCount: existingPlayers.size,
      incomingPlayerCount: incomingPlayers.size,
      addedPlayerCount: addedPlayerNames.length,
      preservedPlayerCount: preservedPlayerNames.length,
      preservedDetailCount,
      needsConfirmation,
    }),
  }
}

function buildRefreshSummary(input: {
  source: DataAssistTeamSummaryParsedDraft['rosterSource']
  existingPlayerCount: number
  incomingPlayerCount: number
  addedPlayerCount: number
  preservedPlayerCount: number
  preservedDetailCount: number
  needsConfirmation: boolean
}) {
  if (!input.existingPlayerCount) {
    return `${input.incomingPlayerCount} player${input.incomingPlayerCount === 1 ? '' : 's'} will be added to this team.`
  }
  if (input.needsConfirmation) {
    const preservedParts = [
      input.preservedPlayerCount ? `${input.preservedPlayerCount} saved player${input.preservedPlayerCount === 1 ? '' : 's'}` : '',
      input.preservedDetailCount ? `${input.preservedDetailCount} saved contact detail${input.preservedDetailCount === 1 ? '' : 's'}` : '',
    ].filter(Boolean)
    return `This upload has less information than the current ${input.source === 'player_roster' ? 'Player Roster' : 'Team Summary'}. TiQ will preserve ${preservedParts.join(' and ')} instead of removing them.`
  }
  if (input.addedPlayerCount) {
    return input.source === 'player_roster'
      ? `${input.addedPlayerCount} new player contact${input.addedPlayerCount === 1 ? '' : 's'} will be added. Refresh Team Summary too if the official roster or ratings changed.`
      : `${input.addedPlayerCount} new player${input.addedPlayerCount === 1 ? '' : 's'} will be added; matching team records will refresh.`
  }
  return 'This team is already saved. Matching records will refresh without creating a duplicate team.'
}

function namesByKey(names: string[]) {
  const byKey = new Map<string, string>()
  for (const name of names) {
    const cleanName = name.trim()
    const key = normalizeCaptainRosterContactKey(cleanName)
    if (key && !byKey.has(key)) byKey.set(key, cleanName)
  }
  return byKey
}

function countContactDetails(rows: Array<{ phone?: string | null; email?: string | null }>) {
  return rows.reduce((count, row) => count + (row.phone?.trim() ? 1 : 0) + (row.email?.trim() ? 1 : 0), 0)
}

function countPreservedContactDetails(
  existingRows: ExistingContactRow[],
  incomingRows: Array<{ name: string; phone?: string | null; email?: string | null }>,
) {
  const incomingByName = new Map(incomingRows.map((row) => [normalizeCaptainRosterContactKey(row.name), row]))
  return existingRows.reduce((count, existing) => {
    const incoming = incomingByName.get(normalizeCaptainRosterContactKey(existing.full_name))
    return count
      + (existing.phone?.trim() && !incoming?.phone?.trim() ? 1 : 0)
      + (existing.email?.trim() && !incoming?.email?.trim() ? 1 : 0)
  }, 0)
}

function normalizeRosterTeamKey(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}
