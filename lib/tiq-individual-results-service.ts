'use client'

import { getClientAuthState } from '@/lib/auth'
import { recalculateDynamicRatings } from '@/lib/recalculateRatings'
import { supabase } from '@/lib/supabase'
import { deleteTiqIndividualResultMatch, syncTiqIndividualResultToMatch } from '@/lib/tiq-match-sync'

const TIQ_INDIVIDUAL_RESULTS_TABLE = 'tiq_individual_league_results'
const LOCAL_RESULTS_KEY = 'tenaceiq-tiq-individual-results-v1'

export type TiqLeagueStorageSource = 'supabase' | 'local'

export type TiqIndividualLeagueResultRecord = {
  id: string
  leagueId: string
  playerAName: string
  playerAId: string
  playerBName: string
  playerBId: string
  winnerPlayerName: string
  winnerPlayerId: string
  score: string
  resultDate: string
  notes: string
  createdAt: string
  updatedAt: string
}

type TiqIndividualLeagueResultRow = {
  id?: string | null
  league_id?: string | null
  player_a_name?: string | null
  player_a_id?: string | null
  player_b_name?: string | null
  player_b_id?: string | null
  winner_player_name?: string | null
  winner_player_id?: string | null
  score?: string | null
  result_date?: string | null
  notes?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type TiqIndividualLeagueResultPayload = {
  id: string
  league_id: string
  player_a_name: string
  player_a_id: string
  player_b_name: string
  player_b_id: string
  winner_player_name: string
  winner_player_id: string
  score: string
  result_date: string
  notes: string
  created_at: string
  updated_at: string
  created_by_user_id: string
  updated_by_user_id: string
}

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
}

function buildLocalId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `tiq-result-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeRow(row: TiqIndividualLeagueResultRow): TiqIndividualLeagueResultRecord | null {
  const id = cleanText(row.id)
  const leagueId = cleanText(row.league_id)
  const playerAName = cleanText(row.player_a_name)
  const playerBName = cleanText(row.player_b_name)
  const winnerPlayerName = cleanText(row.winner_player_name)
  if (!id || !leagueId || !playerAName || !playerBName || !winnerPlayerName) return null

  return {
    id,
    leagueId,
    playerAName,
    playerAId: cleanText(row.player_a_id),
    playerBName,
    playerBId: cleanText(row.player_b_id),
    winnerPlayerName,
    winnerPlayerId: cleanText(row.winner_player_id),
    score: cleanText(row.score),
    resultDate: cleanText(row.result_date),
    notes: cleanText(row.notes),
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
  }
}

function readLocalResults() {
  if (typeof window === 'undefined') return [] as TiqIndividualLeagueResultRecord[]
  try {
    const raw = window.localStorage.getItem(LOCAL_RESULTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalResults(records: TiqIndividualLeagueResultRecord[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LOCAL_RESULTS_KEY, JSON.stringify(records))
}

async function getAuthenticatedUserId() {
  const authState = await getClientAuthState()
  return cleanText(authState.user?.id)
}

function sortResults(records: TiqIndividualLeagueResultRecord[]) {
  return [...records].sort((left, right) => {
    const rightTime = new Date(right.resultDate || right.createdAt).getTime()
    const leftTime = new Date(left.resultDate || left.createdAt).getTime()
    return rightTime - leftTime
  })
}

export async function listTiqIndividualLeagueResults(filters?: {
  leagueId?: string | null
}): Promise<{
  results: TiqIndividualLeagueResultRecord[]
  source: TiqLeagueStorageSource
  warning: string | null
}> {
  const normalizedLeagueId = cleanText(filters?.leagueId)

  try {
    let query = supabase
      .from(TIQ_INDIVIDUAL_RESULTS_TABLE)
      .select(
        'id, league_id, player_a_name, player_a_id, player_b_name, player_b_id, winner_player_name, winner_player_id, score, result_date, notes, created_at, updated_at',
      )
      .order('result_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (normalizedLeagueId) {
      query = query.eq('league_id', normalizedLeagueId)
    }

    const { data, error } = await query
    if (error) throw error

    const results = ((data || []) as TiqIndividualLeagueResultRow[])
      .map(normalizeRow)
      .filter((record): record is TiqIndividualLeagueResultRecord => Boolean(record))

    writeLocalResults(results)

    return {
      results,
      source: 'supabase',
      warning: null,
    }
  } catch (error) {
    const results = sortResults(
      readLocalResults().filter((record) => {
        if (normalizedLeagueId && record.leagueId !== normalizedLeagueId) return false
        return true
      }),
    )

    return {
      results,
      source: 'local',
      warning:
        error instanceof Error
          ? `Using local TIQ individual results because Supabase result storage is not ready yet: ${error.message}`
          : 'Using local TIQ individual results because Supabase result storage is not ready yet.',
    }
  }
}

export async function saveTiqIndividualLeagueResult(input: {
  leagueId: string
  playerAName: string
  playerAId?: string | null
  playerBName: string
  playerBId?: string | null
  winnerPlayerName: string
  winnerPlayerId?: string | null
  score?: string | null
  resultDate?: string | null
  notes?: string | null
}): Promise<{
  result: TiqIndividualLeagueResultRecord
  source: TiqLeagueStorageSource
  warning: string | null
}> {
  const now = new Date().toISOString()
  const localRecord: TiqIndividualLeagueResultRecord = {
    id: buildLocalId(),
    leagueId: cleanText(input.leagueId),
    playerAName: cleanText(input.playerAName),
    playerAId: cleanText(input.playerAId),
    playerBName: cleanText(input.playerBName),
    playerBId: cleanText(input.playerBId),
    winnerPlayerName: cleanText(input.winnerPlayerName),
    winnerPlayerId: cleanText(input.winnerPlayerId),
    score: cleanText(input.score),
    resultDate: cleanText(input.resultDate) || now,
    notes: cleanText(input.notes),
    createdAt: now,
    updatedAt: now,
  }

  writeLocalResults([localRecord, ...readLocalResults().filter((record) => record.id !== localRecord.id)])

  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return {
        result: localRecord,
        source: 'local',
        warning:
          'Saved the TIQ individual result locally because a signed-in user is required before Supabase-backed result writes can satisfy ownership policies.',
      }
    }

    const payload: TiqIndividualLeagueResultPayload = {
      id: localRecord.id,
      league_id: localRecord.leagueId,
      player_a_name: localRecord.playerAName,
      player_a_id: localRecord.playerAId,
      player_b_name: localRecord.playerBName,
      player_b_id: localRecord.playerBId,
      winner_player_name: localRecord.winnerPlayerName,
      winner_player_id: localRecord.winnerPlayerId,
      score: localRecord.score,
      result_date: localRecord.resultDate,
      notes: localRecord.notes,
      created_at: localRecord.createdAt,
      updated_at: localRecord.updatedAt,
      created_by_user_id: userId,
      updated_by_user_id: userId,
    }

    const { error } = await supabase.from(TIQ_INDIVIDUAL_RESULTS_TABLE).insert(payload)
    if (error) throw error

    // Sync into the matches table so both rating tracks pick this up on the next recalculation.
    let syncWarning: string | null = null
    try {
      await syncTiqIndividualResultToMatch({
        id: localRecord.id,
        league_id: localRecord.leagueId,
        player_a_name: localRecord.playerAName,
        player_a_id: localRecord.playerAId || null,
        player_b_name: localRecord.playerBName,
        player_b_id: localRecord.playerBId || null,
        winner_player_name: localRecord.winnerPlayerName,
        winner_player_id: localRecord.winnerPlayerId || null,
        score: localRecord.score,
        result_date: localRecord.resultDate,
      })
      await recalculateDynamicRatings()
    } catch (syncError) {
      syncWarning =
        syncError instanceof Error
          ? `Result saved — rating sync failed and will apply on the next full recalculation: ${syncError.message}`
          : 'Result saved — rating sync failed and will apply on the next full recalculation.'
    }

    return {
      result: localRecord,
      source: 'supabase',
      warning: syncWarning,
    }
  } catch (error) {
    return {
      result: localRecord,
      source: 'local',
      warning:
        error instanceof Error
          ? `Saved the TIQ individual result locally because Supabase result storage is not ready yet: ${error.message}`
          : 'Saved the TIQ individual result locally because Supabase result storage is not ready yet.',
    }
  }
}

export async function deleteTiqIndividualLeagueResult(resultId: string): Promise<{
  source: TiqLeagueStorageSource
  warning: string | null
}> {
  // Remove from local cache regardless of Supabase outcome.
  writeLocalResults(readLocalResults().filter((record) => record.id !== resultId))

  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return {
        source: 'local',
        warning: 'Removed locally only — sign in to delete from Supabase.',
      }
    }

    const { error } = await supabase
      .from(TIQ_INDIVIDUAL_RESULTS_TABLE)
      .delete()
      .eq('id', resultId)

    if (error) throw error

    // Remove the mirrored match row and re-run ratings.
    let syncWarning: string | null = null
    try {
      await deleteTiqIndividualResultMatch(resultId)
      await recalculateDynamicRatings()
    } catch (syncError) {
      syncWarning =
        syncError instanceof Error
          ? `Result deleted — rating sync failed and will apply on the next full recalculation: ${syncError.message}`
          : 'Result deleted — rating sync failed and will apply on the next full recalculation.'
    }

    return { source: 'supabase', warning: syncWarning }
  } catch (error) {
    return {
      source: 'local',
      warning:
        error instanceof Error
          ? `Deleted locally — Supabase removal failed: ${error.message}`
          : 'Deleted locally — Supabase removal failed.',
    }
  }
}
