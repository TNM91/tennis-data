'use client'

import { supabase } from './supabase'

export type CompetitionScheduleResponseState = 'available' | 'unavailable' | 'waiting' | 'changed'

export type CompetitionScheduleResponse = {
  eventId: string
  playerName: string
  response: 'available' | 'unavailable'
  eventSnapshot: {
    date: string
    time: string
    location: string
  }
  updatedAt: string
}

export type CompetitionScheduleResponseSummary = {
  rows: Array<{
    playerName: string
    state: CompetitionScheduleResponseState
    updatedAt: string
  }>
  availableCount: number
  unavailableCount: number
  waitingCount: number
  changedCount: number
  needsAction: boolean
}

type ResponseRow = {
  player_user_id?: string | null
  event_id?: string | null
  response?: string | null
  event_snapshot?: Record<string, unknown> | null
  updated_at?: string | null
}

type EntryRow = {
  player_name?: string | null
  created_by_user_id?: string | null
  submitted_by_user_id?: string | null
}

type OwnerRow = {
  created_by_user_id?: string | null
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function normalizeName(value: unknown) {
  return cleanText(value).toLocaleLowerCase()
}

export function buildCompetitionScheduleResponseSummary(input: {
  eventId: string
  expectedPlayerNames: string[]
  responses: CompetitionScheduleResponse[]
  currentSnapshot: {
    date: string
    time: string
    location: string
  }
}): CompetitionScheduleResponseSummary {
  const expectedPlayerNames = Array.from(new Set(input.expectedPlayerNames.map(cleanText).filter(Boolean)))
  const responsesByPlayer = new Map(
    input.responses
      .filter((response) => response.eventId === input.eventId)
      .map((response) => [normalizeName(response.playerName), response]),
  )

  const rows = expectedPlayerNames.map((playerName) => {
    const response = responsesByPlayer.get(normalizeName(playerName))
    if (!response) return { playerName, state: 'waiting' as const, updatedAt: '' }

    const changed = response.eventSnapshot.date !== cleanText(input.currentSnapshot.date)
      || response.eventSnapshot.time !== cleanText(input.currentSnapshot.time)
      || response.eventSnapshot.location !== cleanText(input.currentSnapshot.location)

    return {
      playerName,
      state: changed ? 'changed' as const : response.response,
      updatedAt: response.updatedAt,
    }
  })

  const availableCount = rows.filter((row) => row.state === 'available').length
  const unavailableCount = rows.filter((row) => row.state === 'unavailable').length
  const waitingCount = rows.filter((row) => row.state === 'waiting').length
  const changedCount = rows.filter((row) => row.state === 'changed').length

  return {
    rows,
    availableCount,
    unavailableCount,
    waitingCount,
    changedCount,
    needsAction: unavailableCount > 0 || changedCount > 0,
  }
}

export async function loadCompetitionScheduleResponses(input: {
  competitionKind: 'league' | 'tournament'
  competitionId: string
  userId: string
}): Promise<{ authorized: boolean; responses: CompetitionScheduleResponse[] }> {
  const competitionId = cleanText(input.competitionId)
  const userId = cleanText(input.userId)
  if (!competitionId || !userId) return { authorized: false, responses: [] }

  const competitionTable = input.competitionKind === 'league' ? 'tiq_leagues' : 'tiq_tournaments'
  const entryTable = input.competitionKind === 'league' ? 'tiq_player_league_entries' : 'tiq_tournament_entries'
  const competitionColumn = input.competitionKind === 'league' ? 'league_id' : 'tournament_id'
  const userColumn = input.competitionKind === 'league' ? 'created_by_user_id' : 'submitted_by_user_id'
  const statusColumn = input.competitionKind === 'league' ? 'entry_status' : 'status'
  const activeStatus = input.competitionKind === 'league' ? 'active' : 'approved'

  const [ownerResult, responseResult, entryResult] = await Promise.all([
    supabase.from(competitionTable).select('created_by_user_id').eq('id', competitionId).maybeSingle(),
    supabase
      .from('player_schedule_responses')
      .select('player_user_id,event_id,response,event_snapshot,updated_at')
      .eq('competition_kind', input.competitionKind)
      .eq('competition_id', competitionId),
    supabase
      .from(entryTable)
      .select(`player_name,${userColumn}`)
      .eq(competitionColumn, competitionId)
      .eq(statusColumn, activeStatus),
  ])

  const ownerId = cleanText((ownerResult.data as OwnerRow | null)?.created_by_user_id)
  const authorized = ownerId === userId && !ownerResult.error
  if (!authorized || responseResult.error || entryResult.error) {
    return { authorized, responses: [] }
  }

  const nameByUserId = new Map(
    ((entryResult.data ?? []) as EntryRow[]).map((entry) => [
      cleanText(entry[userColumn as keyof EntryRow]),
      cleanText(entry.player_name),
    ]),
  )

  const responses = ((responseResult.data ?? []) as ResponseRow[]).flatMap((row) => {
    const playerName = nameByUserId.get(cleanText(row.player_user_id)) || ''
    const response: CompetitionScheduleResponse['response'] | null =
      row.response === 'available' || row.response === 'unavailable' ? row.response : null
    if (!playerName || !response) return []
    const snapshot = row.event_snapshot ?? {}
    return [{
      eventId: cleanText(row.event_id),
      playerName,
      response,
      eventSnapshot: {
        date: cleanText(snapshot.date),
        time: cleanText(snapshot.time),
        location: cleanText(snapshot.location),
      },
      updatedAt: cleanText(row.updated_at),
    }]
  })

  return { authorized, responses }
}
