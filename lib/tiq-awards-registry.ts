'use client'

import { supabase } from './supabase'
import {
  buildTournamentPreview,
  summarizeTournamentResults,
  type TiqTournamentRecord,
} from './tiq-tournament-registry'

export const TIQ_AWARDS_REGISTRY_STORAGE_KEY = 'tenaceiq_tiq_awards_registry'

export type TiqAwardPlacement = 'first' | 'second' | 'third'
export type TiqAwardSourceType = 'tournament' | 'league'

export type TiqAwardRecord = {
  id: string
  sourceType: TiqAwardSourceType
  sourceId: string
  sourceName: string
  recipientName: string
  recipientPlayerId: string
  placement: TiqAwardPlacement
  title: string
  subtitle: string
  badgeLabel: string
  badgeCode: string
  coordinatorName: string
  notes: string
  issuedAt: string
  createdAt: string
  updatedAt: string
}

export type TiqAwardDraft = Omit<TiqAwardRecord, 'id' | 'createdAt' | 'updatedAt' | 'badgeLabel' | 'badgeCode' | 'issuedAt'>

export type TiqTournamentAwardCandidate = {
  placement: TiqAwardPlacement
  label: string
  recipientName: string
  recipientOptions: string[]
  helperText: string
}

export type TiqLeagueAwardFinisher = {
  recipientName: string
  recipientPlayerId?: string
  detail?: string
}

export type TiqLeagueAwardCandidate = {
  placement: TiqAwardPlacement
  label: string
  recipientName: string
  recipientPlayerId: string
  helperText: string
}

type TiqAwardCloudRow = {
  id: string
  source_type: string | null
  source_id: string | null
  source_name: string | null
  recipient_name: string | null
  recipient_player_id: string | null
  placement: string | null
  title: string | null
  subtitle: string | null
  badge_label: string | null
  badge_code: string | null
  coordinator_name: string | null
  notes: string | null
  issued_at: string | null
  created_at: string | null
  updated_at: string | null
}

function cleanText(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function normalizeSourceType(value: string | null | undefined): TiqAwardSourceType {
  return value === 'league' ? 'league' : 'tournament'
}

function normalizeTiqAwardRecord(record: Partial<TiqAwardRecord>): TiqAwardRecord {
  const placement = normalizeTiqAwardPlacement(record.placement)
  return {
    id: cleanText(record.id),
    sourceType: normalizeSourceType(record.sourceType),
    sourceId: cleanText(record.sourceId),
    sourceName: cleanText(record.sourceName),
    recipientName: cleanText(record.recipientName),
    recipientPlayerId: cleanText(record.recipientPlayerId),
    placement,
    title: cleanText(record.title) || getTiqAwardPlacementLabel(placement),
    subtitle: cleanText(record.subtitle),
    badgeLabel: cleanText(record.badgeLabel) || getTiqAwardBadgeLabel(placement),
    badgeCode: cleanText(record.badgeCode) || getTiqAwardBadgeCode(placement),
    coordinatorName: cleanText(record.coordinatorName),
    notes: cleanText(record.notes),
    issuedAt: cleanText(record.issuedAt),
    createdAt: cleanText(record.createdAt),
    updatedAt: cleanText(record.updatedAt),
  }
}

function mapCloudAwardRow(row: TiqAwardCloudRow): TiqAwardRecord {
  return normalizeTiqAwardRecord({
    id: row.id,
    sourceType: normalizeSourceType(row.source_type),
    sourceId: row.source_id || '',
    sourceName: row.source_name || '',
    recipientName: row.recipient_name || '',
    recipientPlayerId: row.recipient_player_id || '',
    placement: normalizeTiqAwardPlacement(row.placement),
    title: row.title || '',
    subtitle: row.subtitle || '',
    badgeLabel: row.badge_label || '',
    badgeCode: row.badge_code || '',
    coordinatorName: row.coordinator_name || '',
    notes: row.notes || '',
    issuedAt: row.issued_at || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  })
}

function toCloudAwardPayload(record: TiqAwardRecord, userId: string) {
  return {
    id: record.id,
    source_type: record.sourceType,
    source_id: record.sourceId,
    source_name: record.sourceName,
    recipient_name: record.recipientName,
    recipient_player_id: record.recipientPlayerId || null,
    placement: record.placement,
    title: record.title,
    subtitle: record.subtitle,
    badge_label: record.badgeLabel,
    badge_code: record.badgeCode,
    coordinator_name: record.coordinatorName,
    notes: record.notes,
    issued_at: record.issuedAt,
    updated_by_user_id: userId,
    created_by_user_id: userId,
  }
}

function mergeLocalAwardRecord(record: TiqAwardRecord) {
  const registry = readTiqAwardsRegistry()
  writeTiqAwardsRegistry([record, ...registry.filter((item) => item.id !== record.id)])
}

export function normalizeTiqAwardPlacement(value: string | null | undefined): TiqAwardPlacement {
  if (value === 'second' || value === 'third') return value
  return 'first'
}

export function getTiqAwardPlacementLabel(placement: TiqAwardPlacement) {
  if (placement === 'second') return '2nd Place'
  if (placement === 'third') return '3rd Place'
  return '1st Place'
}

export function getTiqAwardBadgeLabel(placement: TiqAwardPlacement) {
  if (placement === 'second') return 'Finalist'
  if (placement === 'third') return 'Podium'
  return 'Champion'
}

export function getTiqAwardBadgeCode(placement: TiqAwardPlacement) {
  if (placement === 'second') return '2ND'
  if (placement === 'third') return '3RD'
  return '1ST'
}

export function readTiqAwardsRegistry(): TiqAwardRecord[] {
  if (typeof window === 'undefined') return []

  const parsed = safeJsonParse<TiqAwardRecord[]>(window.localStorage.getItem(TIQ_AWARDS_REGISTRY_STORAGE_KEY))
  if (!Array.isArray(parsed)) return []

  return parsed
    .filter((record) => record && typeof record === 'object')
    .map((record): TiqAwardRecord => normalizeTiqAwardRecord(record))
    .filter((record) => record.id && record.sourceId && record.sourceName && record.recipientName)
    .sort((a, b) => new Date(b.issuedAt || b.updatedAt || 0).getTime() - new Date(a.issuedAt || a.updatedAt || 0).getTime())
}

export function writeTiqAwardsRegistry(records: TiqAwardRecord[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(TIQ_AWARDS_REGISTRY_STORAGE_KEY, JSON.stringify(records))
}

export function upsertTiqAwardRecord(draft: TiqAwardDraft) {
  const registry = readTiqAwardsRegistry()
  const now = new Date().toISOString()
  const placement = normalizeTiqAwardPlacement(draft.placement)
  const sourceType = normalizeSourceType(draft.sourceType)
  const sourceId = cleanText(draft.sourceId)
  const recipientName = cleanText(draft.recipientName)
  const id = buildAwardId({ sourceType, sourceId, placement, recipientName })
  const existing = registry.find((record) => record.id === id)
  const nextRecord: TiqAwardRecord = {
    id,
    sourceType,
    sourceId,
    sourceName: cleanText(draft.sourceName),
    recipientName,
    recipientPlayerId: cleanText(draft.recipientPlayerId),
    placement,
    title: cleanText(draft.title) || getTiqAwardPlacementLabel(placement),
    subtitle: cleanText(draft.subtitle),
    badgeLabel: getTiqAwardBadgeLabel(placement),
    badgeCode: getTiqAwardBadgeCode(placement),
    coordinatorName: cleanText(draft.coordinatorName),
    notes: cleanText(draft.notes),
    issuedAt: existing?.issuedAt || now,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }

  if (!nextRecord.sourceId || !nextRecord.sourceName || !nextRecord.recipientName) return null

  writeTiqAwardsRegistry([nextRecord, ...registry.filter((record) => record.id !== id)])
  return nextRecord
}

export async function saveTiqAwardRecordForUser(draft: TiqAwardDraft, userId?: string | null) {
  const record = upsertTiqAwardRecord(draft)
  if (!record) return { data: null, error: null, source: 'local' as const }

  if (!userId) {
    return { data: record, error: null, source: 'local' as const }
  }

  const result = await supabase
    .from('tiq_awards')
    .upsert(toCloudAwardPayload(record, userId), { onConflict: 'id' })
    .select('id,source_type,source_id,source_name,recipient_name,recipient_player_id,placement,title,subtitle,badge_label,badge_code,coordinator_name,notes,issued_at,created_at,updated_at')
    .maybeSingle()

  if (result.error) {
    return { data: record, error: new Error(result.error.message), source: 'local' as const }
  }

  const nextRecord = mapCloudAwardRow(result.data as TiqAwardCloudRow)
  mergeLocalAwardRecord(nextRecord)
  return { data: nextRecord, error: null, source: 'cloud' as const }
}

export function readTiqAwardsForSource(sourceType: TiqAwardSourceType, sourceId: string) {
  const normalizedType = normalizeSourceType(sourceType)
  const normalizedId = cleanText(sourceId)
  return readTiqAwardsRegistry().filter((record) => record.sourceType === normalizedType && record.sourceId === normalizedId)
}

export function readTiqAwardsForRecipient(recipientName: string) {
  const normalizedName = cleanText(recipientName).toLowerCase()
  if (!normalizedName) return []
  return readTiqAwardsRegistry().filter((record) => record.recipientName.toLowerCase() === normalizedName)
}

export function readTiqAwardsForPlayerId(playerId: string) {
  const normalizedId = cleanText(playerId)
  if (!normalizedId) return []
  return readTiqAwardsRegistry().filter((record) => record.recipientPlayerId === normalizedId)
}

export function readTiqAwardById(id: string) {
  const normalizedId = cleanText(id)
  if (!normalizedId) return null
  return readTiqAwardsRegistry().find((record) => record.id === normalizedId) || null
}

export async function loadTiqAwardById(id: string) {
  const normalizedId = cleanText(id)
  const localAward = readTiqAwardById(normalizedId)
  if (!normalizedId) return { data: localAward, error: null, source: 'local' as const }

  const result = await supabase
    .from('tiq_awards')
    .select('id,source_type,source_id,source_name,recipient_name,recipient_player_id,placement,title,subtitle,badge_label,badge_code,coordinator_name,notes,issued_at,created_at,updated_at')
    .eq('id', normalizedId)
    .maybeSingle()

  if (result.error) {
    return { data: localAward, error: new Error(result.error.message), source: 'local' as const }
  }

  if (!result.data) return { data: localAward, error: null, source: localAward ? 'local' as const : 'none' as const }

  const cloudAward = mapCloudAwardRow(result.data as TiqAwardCloudRow)
  mergeLocalAwardRecord(cloudAward)
  return { data: cloudAward, error: null, source: 'cloud' as const }
}

export async function loadRecentTiqAwards(limit = 200) {
  const localAwards = readTiqAwardsRegistry().slice(0, limit)

  const result = await supabase
    .from('tiq_awards')
    .select('id,source_type,source_id,source_name,recipient_name,recipient_player_id,placement,title,subtitle,badge_label,badge_code,coordinator_name,notes,issued_at,created_at,updated_at')
    .order('issued_at', { ascending: false })
    .limit(limit)

  if (result.error) {
    return { data: localAwards, error: new Error(result.error.message), source: 'local' as const }
  }

  const cloudAwards = ((result.data || []) as TiqAwardCloudRow[]).map(mapCloudAwardRow)
  cloudAwards.forEach(mergeLocalAwardRecord)
  return { data: mergeAwards(cloudAwards, localAwards).slice(0, limit), error: null, source: 'cloud' as const }
}

export async function loadTiqAwardsForSource(sourceType: TiqAwardSourceType, sourceId: string) {
  const normalizedType = normalizeSourceType(sourceType)
  const normalizedId = cleanText(sourceId)
  const localAwards = readTiqAwardsForSource(normalizedType, normalizedId)
  if (!normalizedId) return { data: localAwards, error: null, source: 'local' as const }

  const result = await supabase
    .from('tiq_awards')
    .select('id,source_type,source_id,source_name,recipient_name,recipient_player_id,placement,title,subtitle,badge_label,badge_code,coordinator_name,notes,issued_at,created_at,updated_at')
    .eq('source_type', normalizedType)
    .eq('source_id', normalizedId)
    .order('issued_at', { ascending: false })

  if (result.error) {
    return { data: localAwards, error: new Error(result.error.message), source: 'local' as const }
  }

  const cloudAwards = ((result.data || []) as TiqAwardCloudRow[]).map(mapCloudAwardRow)
  cloudAwards.forEach(mergeLocalAwardRecord)
  return { data: mergeAwards(cloudAwards, localAwards), error: null, source: 'cloud' as const }
}

export async function loadTiqAwardsForPlayer(playerId: string, recipientName?: string | null) {
  const normalizedPlayerId = cleanText(playerId)
  const normalizedRecipient = cleanText(recipientName).toLowerCase()
  const localAwards = mergeAwards(
    readTiqAwardsForPlayerId(normalizedPlayerId),
    normalizedRecipient ? readTiqAwardsForRecipient(normalizedRecipient) : [],
  )
  if (!normalizedPlayerId && !normalizedRecipient) return { data: localAwards, error: null, source: 'local' as const }

  let query = supabase
    .from('tiq_awards')
    .select('id,source_type,source_id,source_name,recipient_name,recipient_player_id,placement,title,subtitle,badge_label,badge_code,coordinator_name,notes,issued_at,created_at,updated_at')
    .order('issued_at', { ascending: false })

  if (normalizedPlayerId && normalizedRecipient) {
    query = query.or(`recipient_player_id.eq.${normalizedPlayerId},recipient_name.ilike.${escapeSupabaseLike(recipientName || '')}`)
  } else if (normalizedPlayerId) {
    query = query.eq('recipient_player_id', normalizedPlayerId)
  } else {
    query = query.ilike('recipient_name', recipientName || '')
  }

  const result = await query

  if (result.error) {
    return { data: localAwards, error: new Error(result.error.message), source: 'local' as const }
  }

  const cloudAwards = ((result.data || []) as TiqAwardCloudRow[]).map(mapCloudAwardRow)
  cloudAwards.forEach(mergeLocalAwardRecord)
  return { data: mergeAwards(cloudAwards, localAwards), error: null, source: 'cloud' as const }
}

export function buildTiqTournamentAwardCandidates(record: TiqTournamentRecord): TiqTournamentAwardCandidate[] {
  const matches = buildTournamentPreview(record)
  const summary = summarizeTournamentResults(record)
  const finalMatch = matches.find((match) => match.label === 'Final') || (matches.length === 1 ? matches[0] : null)
  const finalWinner = finalMatch?.result?.winner || summary.champion
  const finalLoser = finalMatch?.result?.winner
    ? [finalMatch.sideA, finalMatch.sideB].find((side) => side !== finalMatch.result?.winner && side !== 'Bye' && !side.startsWith('Winner ')) || ''
    : ''
  const semifinalLosers = finalMatch
    ? matches
        .filter((match) => match.round === finalMatch.round - 1)
        .map((match) => getMatchLoser(match.sideA, match.sideB, match.result?.winner))
        .filter(Boolean)
    : []

  return [
    {
      placement: 'first',
      label: getTiqAwardPlacementLabel('first'),
      recipientName: finalWinner || '',
      recipientOptions: finalWinner ? [finalWinner] : [],
      helperText: finalWinner ? 'Champion detected from the final.' : 'Complete the final to fill the champion.',
    },
    {
      placement: 'second',
      label: getTiqAwardPlacementLabel('second'),
      recipientName: finalLoser,
      recipientOptions: finalLoser ? [finalLoser] : [],
      helperText: finalLoser ? 'Finalist detected from the final.' : 'Complete the final to fill the finalist.',
    },
    {
      placement: 'third',
      label: getTiqAwardPlacementLabel('third'),
      recipientName: semifinalLosers.length === 1 ? semifinalLosers[0] : '',
      recipientOptions: semifinalLosers,
      helperText: semifinalLosers.length
        ? 'Choose from the semifinal finishers, or type a third-place playoff winner.'
        : 'Semifinal finishers appear here when the bracket is deep enough.',
    },
  ]
}

export function buildTiqLeagueAwardCandidates(finishers: TiqLeagueAwardFinisher[]): TiqLeagueAwardCandidate[] {
  const cleanFinishers = finishers
    .map((finisher) => ({
      recipientName: cleanText(finisher.recipientName),
      recipientPlayerId: cleanText(finisher.recipientPlayerId),
      detail: cleanText(finisher.detail),
    }))
    .filter((finisher) => finisher.recipientName)
    .slice(0, 3)
  const placements: TiqAwardPlacement[] = ['first', 'second', 'third']

  return placements.map((placement, index) => {
    const finisher = cleanFinishers[index]
    return {
      placement,
      label: getTiqAwardPlacementLabel(placement),
      recipientName: finisher?.recipientName || '',
      recipientPlayerId: finisher?.recipientPlayerId || '',
      helperText: finisher?.detail || (finisher ? 'League finisher detected from standings.' : 'Add results to fill this league award.'),
    }
  })
}

export function buildTiqAwardCertificateText(record: TiqAwardRecord) {
  const placement = getTiqAwardPlacementLabel(record.placement)
  const sourceLabel = record.sourceType === 'league' ? 'league season' : 'tournament'
  return [
    `TenAceIQ ${placement}`,
    record.recipientName,
    `${record.title} in ${record.sourceName}`,
    record.subtitle || `Recognized for a ${sourceLabel} finish.`,
    record.notes,
    'More Tennis. Less Chaos.',
  ].filter(Boolean).join('\n')
}

function buildAwardId(input: {
  sourceType: TiqAwardSourceType
  sourceId: string
  placement: TiqAwardPlacement
  recipientName: string
}) {
  return `${input.sourceType}-${input.sourceId}-${input.placement}-${input.recipientName}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function mergeAwards(primary: TiqAwardRecord[], secondary: TiqAwardRecord[]) {
  const byId = new Map<string, TiqAwardRecord>()
  for (const award of [...primary, ...secondary]) {
    byId.set(award.id, award)
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.issuedAt || b.updatedAt || 0).getTime() - new Date(a.issuedAt || a.updatedAt || 0).getTime(),
  )
}

function escapeSupabaseLike(value: string) {
  return cleanText(value).replace(/[%_,]/g, '\\$&')
}

function getMatchLoser(sideA: string, sideB: string, winner: string | null | undefined) {
  const normalizedWinner = cleanText(winner)
  if (!normalizedWinner) return ''

  const options = [sideA, sideB].filter((side) => side !== 'Bye' && !side.startsWith('Winner '))
  return options.find((side) => side !== normalizedWinner) || ''
}
