'use client'

import { getClientAuthState } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { normalizeTiqIndividualCompetitionFormat, type TiqIndividualCompetitionFormat } from '@/lib/tiq-individual-format'

const TIQ_INDIVIDUAL_SUGGESTIONS_TABLE = 'tiq_individual_league_suggestions'
const LOCAL_SUGGESTIONS_KEY = 'tenaceiq-tiq-individual-suggestions-v1'

export type TiqLeagueStorageSource = 'supabase' | 'local'

export type TiqIndividualSuggestionStatus = 'open' | 'completed' | 'dismissed'

export type TiqIndividualSuggestionRecord = {
  id: string
  leagueId: string
  individualCompetitionFormat: TiqIndividualCompetitionFormat
  suggestionType: string
  pairKey: string
  title: string
  body: string
  playerAName: string
  playerAId: string
  playerBName: string
  playerBId: string
  claimedByUserId: string
  claimedByLabel: string
  claimedAt: string
  status: TiqIndividualSuggestionStatus
  createdAt: string
  updatedAt: string
}

type TiqIndividualSuggestionRow = {
  id?: string | null
  league_id?: string | null
  individual_competition_format?: string | null
  suggestion_type?: string | null
  pair_key?: string | null
  title?: string | null
  body?: string | null
  player_a_name?: string | null
  player_a_id?: string | null
  player_b_name?: string | null
  player_b_id?: string | null
  claimed_by_user_id?: string | null
  claimed_by_label?: string | null
  claimed_at?: string | null
  status?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type TiqIndividualSuggestionPayload = {
  id: string
  league_id: string
  individual_competition_format: TiqIndividualCompetitionFormat
  suggestion_type: string
  pair_key: string
  title: string
  body: string
  player_a_name: string
  player_a_id: string
  player_b_name: string
  player_b_id: string
  claimed_by_user_id: string
  claimed_by_label: string
  claimed_at: string
  status: TiqIndividualSuggestionStatus
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
  return `tiq-suggestion-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeStatus(value: string | null | undefined): TiqIndividualSuggestionStatus {
  const normalized = cleanText(value).toLowerCase()
  if (normalized === 'completed') return 'completed'
  if (normalized === 'dismissed') return 'dismissed'
  return 'open'
}

function buildPairKey(playerAName: string, playerBName: string) {
  return [cleanText(playerAName).toLowerCase(), cleanText(playerBName).toLowerCase()].sort().join('::')
}

function normalizeRow(row: TiqIndividualSuggestionRow): TiqIndividualSuggestionRecord | null {
  const id = cleanText(row.id)
  const leagueId = cleanText(row.league_id)
  const title = cleanText(row.title)
  const playerAName = cleanText(row.player_a_name)
  const playerBName = cleanText(row.player_b_name)
  if (!id || !leagueId || !title || !playerAName || !playerBName) return null

  return {
    id,
    leagueId,
    individualCompetitionFormat: normalizeTiqIndividualCompetitionFormat(row.individual_competition_format),
    suggestionType: cleanText(row.suggestion_type),
    pairKey: cleanText(row.pair_key) || buildPairKey(playerAName, playerBName),
    title,
    body: cleanText(row.body),
    playerAName,
    playerAId: cleanText(row.player_a_id),
    playerBName,
    playerBId: cleanText(row.player_b_id),
    claimedByUserId: cleanText(row.claimed_by_user_id),
    claimedByLabel: cleanText(row.claimed_by_label),
    claimedAt: cleanText(row.claimed_at),
    status: normalizeStatus(row.status),
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
  }
}

function readLocalSuggestions() {
  if (typeof window === 'undefined') return [] as TiqIndividualSuggestionRecord[]
  try {
    const raw = window.localStorage.getItem(LOCAL_SUGGESTIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalSuggestions(records: TiqIndividualSuggestionRecord[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LOCAL_SUGGESTIONS_KEY, JSON.stringify(records))
}

function sortSuggestions(records: TiqIndividualSuggestionRecord[]) {
  return [...records].sort((left, right) => {
    const statusWeight = (value: TiqIndividualSuggestionStatus) => {
      if (value === 'open') return 0
      if (value === 'completed') return 1
      return 2
    }
    const statusDiff = statusWeight(left.status) - statusWeight(right.status)
    if (statusDiff !== 0) return statusDiff
    return new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime()
  })
}

function upsertLocalSuggestion(record: TiqIndividualSuggestionRecord) {
  const existing = readLocalSuggestions().filter((item) => item.id !== record.id)
  writeLocalSuggestions(sortSuggestions([record, ...existing]))
}

async function getAuthenticatedUserId() {
  const authState = await getClientAuthState()
  return cleanText(authState.user?.id)
}

async function getAuthenticatedUserIdentity() {
  const authState = await getClientAuthState()
  return {
    userId: cleanText(authState.user?.id),
    label: cleanText(authState.user?.email) || 'TenAceIQ member',
  }
}

export function buildTiqSuggestionPairKey(playerAName: string, playerBName: string) {
  return buildPairKey(playerAName, playerBName)
}

export async function listTiqIndividualSuggestions(filters?: {
  leagueId?: string | null
  status?: TiqIndividualSuggestionStatus | 'all' | null
}): Promise<{
  suggestions: TiqIndividualSuggestionRecord[]
  source: TiqLeagueStorageSource
  warning: string | null
}> {
  const normalizedLeagueId = cleanText(filters?.leagueId)
  const normalizedStatus = filters?.status && filters.status !== 'all' ? filters.status : null

  try {
    let query = supabase
      .from(TIQ_INDIVIDUAL_SUGGESTIONS_TABLE)
      .select(
        'id, league_id, individual_competition_format, suggestion_type, pair_key, title, body, player_a_name, player_a_id, player_b_name, player_b_id, claimed_by_user_id, claimed_by_label, claimed_at, status, created_at, updated_at',
      )
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })

    if (normalizedLeagueId) {
      query = query.eq('league_id', normalizedLeagueId)
    }
    if (normalizedStatus) {
      query = query.eq('status', normalizedStatus)
    }

    const { data, error } = await query
    if (error) throw error

    const suggestions = ((data || []) as TiqIndividualSuggestionRow[])
      .map(normalizeRow)
      .filter((record): record is TiqIndividualSuggestionRecord => Boolean(record))

    writeLocalSuggestions(suggestions)

    return {
      suggestions: sortSuggestions(suggestions),
      source: 'supabase',
      warning: null,
    }
  } catch (error) {
    const suggestions = sortSuggestions(
      readLocalSuggestions().filter((record) => {
        if (normalizedLeagueId && record.leagueId !== normalizedLeagueId) return false
        if (normalizedStatus && record.status !== normalizedStatus) return false
        return true
      }),
    )

    return {
      suggestions,
      source: 'local',
      warning:
        error instanceof Error
          ? 'TIQ prompts are available on this device while cloud sync catches up.'
          : 'TIQ prompts are available on this device while cloud sync catches up.',
    }
  }
}

export async function saveTiqIndividualSuggestion(input: {
  leagueId: string
  individualCompetitionFormat: TiqIndividualCompetitionFormat | string | null | undefined
  suggestionType: string
  title: string
  body?: string | null
  playerAName: string
  playerAId?: string | null
  playerBName: string
  playerBId?: string | null
}): Promise<{
  suggestion: TiqIndividualSuggestionRecord
  source: TiqLeagueStorageSource
  warning: string | null
}> {
  const now = new Date().toISOString()
  const pairKey = buildPairKey(input.playerAName, input.playerBName)
  const existing = readLocalSuggestions().find(
    (record) =>
      record.leagueId === cleanText(input.leagueId) &&
      record.pairKey === pairKey &&
      record.suggestionType === cleanText(input.suggestionType) &&
      record.status === 'open',
  )

  const localSuggestion: TiqIndividualSuggestionRecord = {
    id: existing?.id || buildLocalId(),
    leagueId: cleanText(input.leagueId),
    individualCompetitionFormat: normalizeTiqIndividualCompetitionFormat(input.individualCompetitionFormat),
    suggestionType: cleanText(input.suggestionType) || 'general',
    pairKey,
    title: cleanText(input.title),
    body: cleanText(input.body),
    playerAName: cleanText(input.playerAName),
    playerAId: cleanText(input.playerAId),
    playerBName: cleanText(input.playerBName),
    playerBId: cleanText(input.playerBId),
    claimedByUserId: existing?.claimedByUserId || '',
    claimedByLabel: existing?.claimedByLabel || '',
    claimedAt: existing?.claimedAt || '',
    status: 'open',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }

  upsertLocalSuggestion(localSuggestion)

  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return {
        suggestion: localSuggestion,
        source: 'local',
        warning:
          'Sign in to sync this TIQ prompt across devices. It is saved on this device for now.',
      }
    }

    const payload: TiqIndividualSuggestionPayload = {
      id: localSuggestion.id,
      league_id: localSuggestion.leagueId,
      individual_competition_format: localSuggestion.individualCompetitionFormat,
      suggestion_type: localSuggestion.suggestionType,
      pair_key: localSuggestion.pairKey,
      title: localSuggestion.title,
      body: localSuggestion.body,
      player_a_name: localSuggestion.playerAName,
      player_a_id: localSuggestion.playerAId,
      player_b_name: localSuggestion.playerBName,
      player_b_id: localSuggestion.playerBId,
      claimed_by_user_id: localSuggestion.claimedByUserId,
      claimed_by_label: localSuggestion.claimedByLabel,
      claimed_at: localSuggestion.claimedAt,
      status: localSuggestion.status,
      created_at: localSuggestion.createdAt,
      updated_at: localSuggestion.updatedAt,
      created_by_user_id: userId,
      updated_by_user_id: userId,
    }

    const { error } = await supabase.from(TIQ_INDIVIDUAL_SUGGESTIONS_TABLE).upsert(payload)
    if (error) throw error

    return {
      suggestion: localSuggestion,
      source: 'supabase',
      warning: null,
    }
  } catch (error) {
    return {
      suggestion: localSuggestion,
      source: 'local',
      warning:
        error instanceof Error
          ? 'TIQ prompt saved on this device. Cloud sync will retry later.'
          : 'TIQ prompt saved on this device. Cloud sync will retry later.',
    }
  }
}

export async function updateTiqIndividualSuggestionStatus(input: {
  suggestionId: string
  status: TiqIndividualSuggestionStatus
}): Promise<{
  source: TiqLeagueStorageSource
  warning: string | null
}> {
  const normalizedSuggestionId = cleanText(input.suggestionId)
  const nextStatus = input.status
  const localMatches = readLocalSuggestions()
  const existing = localMatches.find((record) => record.id === normalizedSuggestionId) || null
  if (!existing) {
    return {
      source: 'local',
      warning: 'This TIQ suggestion is no longer available.',
    }
  }

  const localSuggestion = {
    ...existing,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  }
  upsertLocalSuggestion(localSuggestion)

  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return {
        source: 'local',
        warning:
          'Sign in to sync this TIQ prompt across devices. It is updated on this device for now.',
      }
    }

    const { error } = await supabase
      .from(TIQ_INDIVIDUAL_SUGGESTIONS_TABLE)
      .update({
        status: nextStatus,
        updated_at: localSuggestion.updatedAt,
        updated_by_user_id: userId,
      })
      .eq('id', normalizedSuggestionId)
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
          ? 'TIQ prompt updated on this device. Cloud sync will retry later.'
          : 'TIQ prompt updated on this device. Cloud sync will retry later.',
    }
  }
}

export async function claimTiqIndividualSuggestion(input: {
  suggestionId: string
}): Promise<{
  suggestion: TiqIndividualSuggestionRecord | null
  source: TiqLeagueStorageSource
  warning: string | null
}> {
  const normalizedSuggestionId = cleanText(input.suggestionId)
  const localMatches = readLocalSuggestions()
  const existing = localMatches.find((record) => record.id === normalizedSuggestionId) || null
  if (!existing) {
    return {
      suggestion: null,
      source: 'local',
      warning: 'This TIQ suggestion is no longer available.',
    }
  }

  const identity = await getAuthenticatedUserIdentity()
  if (!identity.userId) {
    return {
      suggestion: null,
      source: 'local',
      warning:
        'Sign in to claim this TIQ prompt so ownership can stay attached across devices.',
    }
  }

  const claimedAt = new Date().toISOString()
  const localSuggestion = {
    ...existing,
    claimedByUserId: identity.userId,
    claimedByLabel: identity.label,
    claimedAt,
    updatedAt: claimedAt,
  }
  upsertLocalSuggestion(localSuggestion)

  try {
    const { error } = await supabase
      .from(TIQ_INDIVIDUAL_SUGGESTIONS_TABLE)
      .update({
        claimed_by_user_id: identity.userId,
        claimed_by_label: identity.label,
        claimed_at: claimedAt,
        updated_at: claimedAt,
        updated_by_user_id: identity.userId,
      })
      .eq('id', normalizedSuggestionId)
    if (error) throw error

    return {
      suggestion: localSuggestion,
      source: 'supabase',
      warning: null,
    }
  } catch (error) {
    return {
      suggestion: localSuggestion,
      source: 'local',
      warning:
        error instanceof Error
          ? 'TIQ prompt claimed on this device. Cloud sync will retry later.'
          : 'TIQ prompt claimed on this device. Cloud sync will retry later.',
    }
  }
}

export async function completeTiqIndividualSuggestionsForPair(input: {
  leagueId: string
  playerAName: string
  playerBName: string
}): Promise<{
  completedSuggestions: TiqIndividualSuggestionRecord[]
  source: TiqLeagueStorageSource
  warning: string | null
}> {
  const normalizedLeagueId = cleanText(input.leagueId)
  const pairKey = buildPairKey(input.playerAName, input.playerBName)
  const localMatches = readLocalSuggestions()
  const matchingIds = localMatches
    .filter(
      (record) =>
        record.leagueId === normalizedLeagueId &&
        record.pairKey === pairKey &&
        record.status === 'open',
    )
    .map((record) => record.id)

  if (!matchingIds.length) {
    return {
      completedSuggestions: [],
      source: 'local',
      warning: null,
    }
  }

  const updatedAt = new Date().toISOString()
  const completedSuggestions = localMatches
    .filter((record) => matchingIds.includes(record.id))
    .map((record) => ({
      ...record,
      status: 'completed' as const,
      updatedAt,
    }))
  writeLocalSuggestions(
    sortSuggestions(
      localMatches.map((record) =>
        matchingIds.includes(record.id) ? { ...record, status: 'completed', updatedAt } : record,
      ),
    ),
  )

  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return {
        completedSuggestions,
        source: 'local',
        warning:
          'Sign in to sync TIQ prompt changes across devices. They are updated on this device for now.',
      }
    }

    const { error } = await supabase
      .from(TIQ_INDIVIDUAL_SUGGESTIONS_TABLE)
      .update({
        status: 'completed',
        updated_at: updatedAt,
        updated_by_user_id: userId,
      })
      .eq('league_id', normalizedLeagueId)
      .eq('pair_key', pairKey)
      .eq('status', 'open')
    if (error) throw error

    return {
      completedSuggestions,
      source: 'supabase',
      warning: null,
    }
  } catch (error) {
    return {
      completedSuggestions,
      source: 'local',
      warning:
        error instanceof Error
          ? 'Matching TIQ prompts marked complete on this device. Cloud sync will retry later.'
          : 'Matching TIQ prompts marked complete on this device. Cloud sync will retry later.',
    }
  }
}
