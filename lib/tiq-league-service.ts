'use client'

import { getClientAuthState } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import {
  deleteTiqLeagueRecord,
  readTiqLeagueRegistry,
  type TiqLeagueDraft,
  type TiqLeagueRecord,
  upsertTiqLeagueRecord,
  writeTiqLeagueRegistry,
} from '@/lib/tiq-league-registry'
import { normalizeTiqIndividualCompetitionFormat } from '@/lib/tiq-individual-format'

const TIQ_LEAGUES_TABLE = 'tiq_leagues'
const TIQ_TEAM_ENTRIES_TABLE = 'tiq_team_league_entries'
const TIQ_PLAYER_ENTRIES_TABLE = 'tiq_player_league_entries'

export type TiqLeagueStorageSource = 'supabase' | 'local'

export type TiqLeagueListResult = {
  records: TiqLeagueRecord[]
  source: TiqLeagueStorageSource
  warning: string | null
}

export type TiqTeamLeagueEntryRecord = {
  leagueId: string
  teamName: string
  teamEntityId: string
  sourceLeagueName: string
  sourceFlight: string
  entryStatus: 'active' | 'removed'
}

export type TiqTeamParticipationRecord = {
  leagueId: string
  leagueName: string
  seasonLabel: string
  leagueFlight: string
  locationLabel: string
  teamName: string
  teamEntityId: string
  sourceLeagueName: string
  sourceFlight: string
}

export type TiqPlayerParticipationRecord = {
  leagueId: string
  leagueName: string
  seasonLabel: string
  leagueFlight: string
  locationLabel: string
  playerName: string
  playerId: string
  playerLocation: string
}

export type TiqPlayerLeagueEntryRecord = {
  leagueId: string
  playerName: string
  playerId: string
  playerLocation: string
  entryStatus: 'active' | 'removed'
}

type TiqLeagueRow = {
  id: string
  competition_layer?: string | null
  league_format?: string | null
  individual_competition_format?: string | null
  league_name?: string | null
  season_label?: string | null
  flight?: string | null
  location_label?: string | null
  captain_team_name?: string | null
  notes?: string | null
  teams?: string[] | null
  players?: string[] | null
  teams_json?: string[] | null
  players_json?: string[] | null
  created_at?: string | null
  updated_at?: string | null
}

type TiqTeamEntryRow = {
  league_id?: string | null
  team_name?: string | null
  team_entity_id?: string | null
  source_league_name?: string | null
  source_flight?: string | null
  entry_status?: string | null
}

type TiqPlayerEntryRow = {
  league_id?: string | null
  player_name?: string | null
  player_id?: string | null
  player_location?: string | null
  entry_status?: string | null
}

type TiqLeagueRemotePayload = {
  id: string
  competition_layer: 'tiq'
  league_format: 'team' | 'individual'
  individual_competition_format: 'standard' | 'ladder' | 'round_robin' | 'challenge'
  league_name: string
  season_label: string
  flight: string
  location_label: string
  captain_team_name: string
  notes: string
  teams: string[]
  players: string[]
  created_at: string
  updated_at: string
  created_by_user_id: string
  updated_by_user_id: string
}

type TiqTeamEntryPayload = {
  league_id: string
  team_name: string
  team_entity_id: string
  source_league_name: string
  source_flight: string
  entry_status: 'active'
  created_by_user_id: string
  updated_by_user_id: string
}

type TiqPlayerEntryPayload = {
  league_id: string
  player_name: string
  player_id: string
  player_location: string
  entry_status: 'active'
  created_by_user_id: string
  updated_by_user_id: string
}

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
}

function normalizeList(values: string[] | null | undefined) {
  if (!Array.isArray(values)) return []

  return Array.from(
    new Set(
      values
        .map((value) => cleanText(value))
        .filter(Boolean),
    ),
  )
}

function normalizeEntryStatus(value: string | null | undefined): 'active' | 'removed' {
  return cleanText(value).toLowerCase() === 'removed' ? 'removed' : 'active'
}

function normalizeRow(row: TiqLeagueRow): TiqLeagueRecord {
  return {
    id: cleanText(row.id),
    competitionLayer: 'tiq',
    leagueFormat: row.league_format === 'individual' ? 'individual' : 'team',
    individualCompetitionFormat: normalizeTiqIndividualCompetitionFormat(row.individual_competition_format),
    leagueName: cleanText(row.league_name),
    seasonLabel: cleanText(row.season_label),
    flight: cleanText(row.flight),
    locationLabel: cleanText(row.location_label),
    captainTeamName: cleanText(row.captain_team_name),
    notes: cleanText(row.notes),
    teams: normalizeList(row.teams ?? row.teams_json),
    players: normalizeList(row.players ?? row.players_json),
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
  }
}

function normalizeTeamEntryRow(row: TiqTeamEntryRow): TiqTeamLeagueEntryRecord | null {
  const leagueId = cleanText(row.league_id)
  const teamName = cleanText(row.team_name)
  if (!leagueId || !teamName) return null

  return {
    leagueId,
    teamName,
    teamEntityId: cleanText(row.team_entity_id),
    sourceLeagueName: cleanText(row.source_league_name),
    sourceFlight: cleanText(row.source_flight),
    entryStatus: normalizeEntryStatus(row.entry_status),
  }
}

function mergeParticipantEntries(
  records: TiqLeagueRecord[],
  teamEntryRows: TiqTeamEntryRow[],
  playerEntryRows: TiqPlayerEntryRow[],
) {
  const teamEntriesByLeague = new Map<string, string[]>()
  const playerEntriesByLeague = new Map<string, string[]>()

  for (const row of teamEntryRows) {
    if (normalizeEntryStatus(row.entry_status) === 'removed') continue
    const leagueId = cleanText(row.league_id)
    const teamName = cleanText(row.team_name)
    if (!leagueId || !teamName) continue
    teamEntriesByLeague.set(leagueId, [...(teamEntriesByLeague.get(leagueId) || []), teamName])
  }

  for (const row of playerEntryRows) {
    if (normalizeEntryStatus(row.entry_status) === 'removed') continue
    const leagueId = cleanText(row.league_id)
    const playerName = cleanText(row.player_name)
    if (!leagueId || !playerName) continue
    playerEntriesByLeague.set(leagueId, [...(playerEntriesByLeague.get(leagueId) || []), playerName])
  }

  return records.map((record) => ({
    ...record,
    teams: normalizeList([...(record.teams || []), ...(teamEntriesByLeague.get(record.id) || [])]),
    players: normalizeList([...(record.players || []), ...(playerEntriesByLeague.get(record.id) || [])]),
  }))
}

function normalizePlayerEntryRow(row: TiqPlayerEntryRow): TiqPlayerLeagueEntryRecord | null {
  const leagueId = cleanText(row.league_id)
  const playerName = cleanText(row.player_name)
  if (!leagueId || !playerName) return null

  return {
    leagueId,
    playerName,
    playerId: cleanText(row.player_id),
    playerLocation: cleanText(row.player_location),
    entryStatus: normalizeEntryStatus(row.entry_status),
  }
}

async function getAuthenticatedUserId() {
  const authState = await getClientAuthState()
  return cleanText(authState.user?.id)
}

function buildRemotePayload(record: TiqLeagueRecord, userId: string): TiqLeagueRemotePayload {
  return {
    id: record.id,
    competition_layer: 'tiq',
    league_format: record.leagueFormat,
    individual_competition_format: normalizeTiqIndividualCompetitionFormat(record.individualCompetitionFormat),
    league_name: record.leagueName,
    season_label: record.seasonLabel,
    flight: record.flight,
    location_label: record.locationLabel,
    captain_team_name: record.captainTeamName,
    notes: record.notes,
    teams: record.teams,
    players: record.players,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    created_by_user_id: userId,
    updated_by_user_id: userId,
  }
}

function appendParticipantToLocalRecord(
  leagueId: string,
  participantName: string,
  format: 'team' | 'individual',
) {
  const registry = readTiqLeagueRegistry()
  const index = registry.findIndex((record) => record.id === cleanText(leagueId))
  if (index < 0) return null

  const existingRecord = registry[index]
  const nextRecord: TiqLeagueRecord = {
    ...existingRecord,
    teams:
      format === 'team'
        ? normalizeList([...existingRecord.teams, participantName])
        : existingRecord.teams,
    players:
      format === 'individual'
        ? normalizeList([...existingRecord.players, participantName])
        : existingRecord.players,
    updatedAt: new Date().toISOString(),
  }

  const nextRegistry = [...registry]
  nextRegistry[index] = nextRecord
  writeTiqLeagueRegistry(nextRegistry)
  return nextRecord
}

async function tryLoadRemoteParticipantEntries() {
  try {
    const [{ data: teamEntries, error: teamEntriesError }, { data: playerEntries, error: playerEntriesError }] =
      await Promise.all([
        supabase
          .from(TIQ_TEAM_ENTRIES_TABLE)
          .select('league_id, team_name, team_entity_id, source_league_name, source_flight, entry_status'),
        supabase
          .from(TIQ_PLAYER_ENTRIES_TABLE)
          .select('league_id, player_name, player_id, player_location, entry_status'),
      ])

    if (teamEntriesError || playerEntriesError) {
      throw new Error(teamEntriesError?.message || playerEntriesError?.message || 'Participation entries unavailable.')
    }

    return {
      teamEntries: (teamEntries || []) as TiqTeamEntryRow[],
      playerEntries: (playerEntries || []) as TiqPlayerEntryRow[],
      warning: null as string | null,
    }
  } catch (error) {
    return {
      teamEntries: [] as TiqTeamEntryRow[],
      playerEntries: [] as TiqPlayerEntryRow[],
      warning:
        error instanceof Error
          ? 'TIQ participation is available from the current league setup while sync catches up.'
          : 'TIQ participation is available from the current league setup while sync catches up.',
    }
  }
}

export async function listTiqLeagues(): Promise<TiqLeagueListResult> {
  try {
    const { data, error } = await supabase
      .from(TIQ_LEAGUES_TABLE)
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) throw error

    const baseRecords = ((data || []) as TiqLeagueRow[])
      .map(normalizeRow)
      .filter((record) => record.id && record.leagueName)

    const participation = await tryLoadRemoteParticipantEntries()
    const records = mergeParticipantEntries(
      baseRecords,
      participation.teamEntries,
      participation.playerEntries,
    )

    writeTiqLeagueRegistry(records)

    return {
      records,
      source: 'supabase',
      warning: participation.warning,
    }
  } catch (error) {
    return {
      records: readTiqLeagueRegistry(),
      source: 'local',
      warning:
        error instanceof Error
          ? 'TIQ leagues are available on this device while cloud sync catches up.'
          : 'TIQ leagues are available on this device while cloud sync catches up.',
    }
  }
}

export async function getTiqLeagueById(
  id: string,
): Promise<{
  record: TiqLeagueRecord | null
  source: TiqLeagueStorageSource
  warning: string | null
}> {
  const result = await listTiqLeagues()
  const normalizedLookup = cleanText(id).toLowerCase()

  return {
    record:
      result.records.find((record) => {
        const recordId = cleanText(record.id).toLowerCase()
        const leagueName = cleanText(record.leagueName).toLowerCase()
        return recordId === normalizedLookup || leagueName === normalizedLookup
      }) || null,
    source: result.source,
    warning: result.warning,
  }
}

export async function listTiqTeamLeagueEntries(
  leagueId: string,
): Promise<{
  entries: TiqTeamLeagueEntryRecord[]
  source: TiqLeagueStorageSource
  warning: string | null
}> {
  const normalizedLeagueId = cleanText(leagueId)

  try {
    const { data, error } = await supabase
      .from(TIQ_TEAM_ENTRIES_TABLE)
      .select('league_id, team_name, team_entity_id, source_league_name, source_flight, entry_status')
      .eq('league_id', normalizedLeagueId)

    if (error) throw error

    const entries = ((data || []) as TiqTeamEntryRow[])
      .map(normalizeTeamEntryRow)
      .filter((entry): entry is TiqTeamLeagueEntryRecord => Boolean(entry))
      .filter((entry) => entry.entryStatus === 'active')

    return {
      entries,
      source: 'supabase',
      warning: null,
    }
  } catch (error) {
    const fallbackLeague = readTiqLeagueRegistry().find((record) => record.id === normalizedLeagueId) || null

    return {
      entries: (fallbackLeague?.teams || []).map((teamName) => ({
        leagueId: normalizedLeagueId,
        teamName,
        teamEntityId: '',
        sourceLeagueName: '',
        sourceFlight: '',
        entryStatus: 'active',
      })),
      source: 'local',
      warning:
        error instanceof Error
          ? 'TIQ team entries are available on this device while cloud sync catches up.'
          : 'TIQ team entries are available on this device while cloud sync catches up.',
    }
  }
}

export async function listTiqTeamParticipations(
  filters?: {
    teamName?: string | null
    sourceLeagueName?: string | null
    sourceFlight?: string | null
  },
): Promise<{
  entries: TiqTeamParticipationRecord[]
  source: TiqLeagueStorageSource
  warning: string | null
}> {
  const normalizedTeamName = cleanText(filters?.teamName).toLowerCase()
  const normalizedSourceLeague = cleanText(filters?.sourceLeagueName).toLowerCase()
  const normalizedSourceFlight = cleanText(filters?.sourceFlight).toLowerCase()

  try {
    const [{ data: entryRows, error: entryError }, leagueResult] = await Promise.all([
      supabase
        .from(TIQ_TEAM_ENTRIES_TABLE)
        .select('league_id, team_name, team_entity_id, source_league_name, source_flight, entry_status'),
      listTiqLeagues(),
    ])

    if (entryError) throw new Error(entryError.message)

    const leaguesById = new Map(leagueResult.records.map((record) => [record.id, record]))
    const entries = ((entryRows || []) as TiqTeamEntryRow[])
      .map(normalizeTeamEntryRow)
      .filter((entry): entry is TiqTeamLeagueEntryRecord => Boolean(entry))
      .filter((entry) => entry.entryStatus === 'active')
      .filter((entry) => {
        if (normalizedTeamName && entry.teamName.toLowerCase() !== normalizedTeamName) return false
        if (
          normalizedSourceLeague &&
          cleanText(entry.sourceLeagueName).toLowerCase() !== normalizedSourceLeague
        ) {
          return false
        }
        if (
          normalizedSourceFlight &&
          cleanText(entry.sourceFlight).toLowerCase() !== normalizedSourceFlight
        ) {
          return false
        }
        return true
      })
      .map((entry) => {
        const league = leaguesById.get(entry.leagueId)
        return {
          leagueId: entry.leagueId,
          leagueName: league?.leagueName || '',
          seasonLabel: league?.seasonLabel || '',
          leagueFlight: league?.flight || '',
          locationLabel: league?.locationLabel || '',
          teamName: entry.teamName,
          teamEntityId: entry.teamEntityId,
          sourceLeagueName: entry.sourceLeagueName,
          sourceFlight: entry.sourceFlight,
        }
      })
      .filter((entry) => entry.leagueId && entry.teamName)

    return {
      entries,
      source: 'supabase',
      warning: leagueResult.warning,
    }
  } catch (error) {
    const fallbackLeagues = readTiqLeagueRegistry()
    const entries = fallbackLeagues
      .flatMap((record) =>
        record.teams.map((teamName) => ({
          leagueId: record.id,
          leagueName: record.leagueName,
          seasonLabel: record.seasonLabel,
          leagueFlight: record.flight,
          locationLabel: record.locationLabel,
          teamName,
          teamEntityId: '',
          sourceLeagueName: '',
          sourceFlight: '',
        })),
      )
      .filter((entry) => {
        if (normalizedTeamName && entry.teamName.toLowerCase() !== normalizedTeamName) return false
        return true
      })

    return {
      entries,
      source: 'local',
      warning:
        error instanceof Error
          ? 'TIQ team participation is available on this device while cloud sync catches up.'
          : 'TIQ team participation is available on this device while cloud sync catches up.',
    }
  }
}

export async function listTiqPlayerLeagueEntries(
  leagueId: string,
): Promise<{
  entries: TiqPlayerLeagueEntryRecord[]
  source: TiqLeagueStorageSource
  warning: string | null
}> {
  const normalizedLeagueId = cleanText(leagueId)

  try {
    const { data, error } = await supabase
      .from(TIQ_PLAYER_ENTRIES_TABLE)
      .select('league_id, player_name, player_id, player_location, entry_status')
      .eq('league_id', normalizedLeagueId)

    if (error) throw error

    const entries = ((data || []) as TiqPlayerEntryRow[])
      .map(normalizePlayerEntryRow)
      .filter((entry): entry is TiqPlayerLeagueEntryRecord => Boolean(entry))
      .filter((entry) => entry.entryStatus === 'active')

    return {
      entries,
      source: 'supabase',
      warning: null,
    }
  } catch (error) {
    const fallbackLeague = readTiqLeagueRegistry().find((record) => record.id === normalizedLeagueId) || null

    return {
      entries: (fallbackLeague?.players || []).map((playerName) => ({
        leagueId: normalizedLeagueId,
        playerName,
        playerId: '',
        playerLocation: '',
        entryStatus: 'active',
      })),
      source: 'local',
      warning:
        error instanceof Error
          ? 'TIQ player entries are available on this device while cloud sync catches up.'
          : 'TIQ player entries are available on this device while cloud sync catches up.',
    }
  }
}

export async function listTiqPlayerParticipations(
  filters?: {
    playerName?: string | null
  },
): Promise<{
  entries: TiqPlayerParticipationRecord[]
  source: TiqLeagueStorageSource
  warning: string | null
}> {
  const normalizedPlayerName = cleanText(filters?.playerName).toLowerCase()

  try {
    const [{ data: entryRows, error: entryError }, leagueResult] = await Promise.all([
      supabase
        .from(TIQ_PLAYER_ENTRIES_TABLE)
        .select('league_id, player_name, player_id, player_location, entry_status'),
      listTiqLeagues(),
    ])

    if (entryError) throw new Error(entryError.message)

    const leaguesById = new Map(leagueResult.records.map((record) => [record.id, record]))
    const entries = ((entryRows || []) as TiqPlayerEntryRow[])
      .map(normalizePlayerEntryRow)
      .filter((entry): entry is TiqPlayerLeagueEntryRecord => Boolean(entry))
      .filter((entry) => entry.entryStatus === 'active')
      .map((entry) => {
        const league = leaguesById.get(entry.leagueId)

        return {
          leagueId: entry.leagueId,
          leagueName: league?.leagueName || '',
          seasonLabel: league?.seasonLabel || '',
          leagueFlight: league?.flight || '',
          locationLabel: league?.locationLabel || '',
          playerName: entry.playerName,
          playerId: entry.playerId,
          playerLocation: entry.playerLocation,
        }
      })
      .filter((entry) => entry.leagueId && entry.playerName)
      .filter((entry) => {
        if (normalizedPlayerName && entry.playerName.toLowerCase() !== normalizedPlayerName) return false
        return true
      })

    return {
      entries,
      source: 'supabase',
      warning: leagueResult.warning,
    }
  } catch (error) {
    const entries = readTiqLeagueRegistry()
      .flatMap((record) =>
        record.players.map((playerName) => ({
          leagueId: record.id,
          leagueName: record.leagueName,
          seasonLabel: record.seasonLabel,
          leagueFlight: record.flight,
          locationLabel: record.locationLabel,
          playerName,
          playerId: '',
          playerLocation: '',
        })),
      )
      .filter((entry) => {
        if (normalizedPlayerName && entry.playerName.toLowerCase() !== normalizedPlayerName) return false
        return true
      })

    return {
      entries,
      source: 'local',
      warning:
        error instanceof Error
          ? 'TIQ individual participation is available on this device while cloud sync catches up.'
          : 'TIQ individual participation is available on this device while cloud sync catches up.',
    }
  }
}

export async function saveTiqLeague(
  draft: TiqLeagueDraft,
  existingId?: string,
): Promise<{ record: TiqLeagueRecord; source: TiqLeagueStorageSource; warning: string | null }> {
  const localRecord = upsertTiqLeagueRecord(draft, existingId)

  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return {
        record: localRecord,
        source: 'local',
        warning:
          'Sign in as a captain to sync this TIQ league across devices. It is saved on this device for now.',
      }
    }

    const payload = buildRemotePayload(localRecord, userId)
    const { error } = await supabase.from(TIQ_LEAGUES_TABLE).upsert(payload)
    if (error) throw error

    return {
      record: localRecord,
      source: 'supabase',
      warning: null,
    }
  } catch (error) {
    return {
      record: localRecord,
      source: 'local',
      warning:
        error instanceof Error
          ? 'TIQ league saved on this device. Cloud sync will retry later.'
          : 'TIQ league saved on this device. Cloud sync will retry later.',
    }
  }
}

export async function addTiqTeamLeagueEntry(
  input: {
    leagueId: string
    teamName: string
    teamEntityId?: string | null
    sourceLeagueName?: string | null
    sourceFlight?: string | null
  },
): Promise<{ record: TiqLeagueRecord | null; source: TiqLeagueStorageSource; warning: string | null }> {
  const normalizedLeagueId = cleanText(input.leagueId)
  const normalizedTeamName = cleanText(input.teamName)
  const localRecord = appendParticipantToLocalRecord(normalizedLeagueId, normalizedTeamName, 'team')

  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return {
        record: localRecord,
        source: 'local',
        warning:
          'Sign in as a captain to sync this TIQ team entry across devices. It is saved on this device for now.',
      }
    }

    const payload: TiqTeamEntryPayload = {
      league_id: normalizedLeagueId,
      team_name: normalizedTeamName,
      team_entity_id: cleanText(input.teamEntityId),
      source_league_name: cleanText(input.sourceLeagueName),
      source_flight: cleanText(input.sourceFlight),
      entry_status: 'active',
      created_by_user_id: userId,
      updated_by_user_id: userId,
    }

    const { error } = await supabase
      .from(TIQ_TEAM_ENTRIES_TABLE)
      .upsert(payload, { onConflict: 'league_id,team_name' })
    if (error) throw error

    const latest = await getTiqLeagueById(normalizedLeagueId)
    return {
      record: latest.record || localRecord,
      source: 'supabase',
      warning: latest.warning,
    }
  } catch (error) {
    return {
      record: localRecord,
      source: 'local',
      warning:
        error instanceof Error
          ? 'TIQ team entry saved on this device. Cloud sync will retry later.'
          : 'TIQ team entry saved on this device. Cloud sync will retry later.',
    }
  }
}

export async function addTiqPlayerLeagueEntry(
  input: {
    leagueId: string
    playerName: string
    playerId?: string | null
    playerLocation?: string | null
  },
): Promise<{ record: TiqLeagueRecord | null; source: TiqLeagueStorageSource; warning: string | null }> {
  const normalizedLeagueId = cleanText(input.leagueId)
  const normalizedPlayerName = cleanText(input.playerName)
  const localRecord = appendParticipantToLocalRecord(normalizedLeagueId, normalizedPlayerName, 'individual')

  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return {
        record: localRecord,
        source: 'local',
        warning:
          'Sign in to sync this TIQ player entry across devices. It is saved on this device for now.',
      }
    }

    const payload: TiqPlayerEntryPayload = {
      league_id: normalizedLeagueId,
      player_name: normalizedPlayerName,
      player_id: cleanText(input.playerId),
      player_location: cleanText(input.playerLocation),
      entry_status: 'active',
      created_by_user_id: userId,
      updated_by_user_id: userId,
    }

    const { error } = await supabase
      .from(TIQ_PLAYER_ENTRIES_TABLE)
      .upsert(payload, { onConflict: 'league_id,player_name' })
    if (error) throw error

    const latest = await getTiqLeagueById(normalizedLeagueId)
    return {
      record: latest.record || localRecord,
      source: 'supabase',
      warning: latest.warning,
    }
  } catch (error) {
    return {
      record: localRecord,
      source: 'local',
      warning:
        error instanceof Error
          ? 'TIQ player entry saved on this device. Cloud sync will retry later.'
          : 'TIQ player entry saved on this device. Cloud sync will retry later.',
    }
  }
}

export async function removeTiqLeague(
  id: string,
): Promise<{ source: TiqLeagueStorageSource; warning: string | null }> {
  deleteTiqLeagueRecord(id)

  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return {
        source: 'local',
        warning:
          'Sign in as a captain to sync this TIQ league change across devices. It was removed on this device.',
      }
    }

    const { error } = await supabase.from(TIQ_LEAGUES_TABLE).delete().eq('id', id)
    if (error) throw error

    return {
      source: 'supabase',
      warning: null,
    }
  } catch (error) {
    return {
      source: 'local',
      warning:
        error instanceof Error
          ? 'TIQ league removed on this device. Cloud sync will retry later.'
          : 'TIQ league removed on this device. Cloud sync will retry later.',
    }
  }
}
