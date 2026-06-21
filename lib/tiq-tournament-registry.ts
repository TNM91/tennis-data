'use client'

import { supabase } from './supabase'

export const TIQ_TOURNAMENT_REGISTRY_STORAGE_KEY = 'tenaceiq_tiq_tournament_registry'

export type TiqTournamentFormat = 'single_elimination' | 'round_robin' | 'compass_draw'
export type TiqTournamentEntrantType = 'players' | 'teams'
export type TiqTournamentStatus = 'draft' | 'open' | 'scheduled' | 'completed'
export type TiqTournamentEntryStatus = 'pending' | 'approved' | 'declined'
export type TiqTournamentAlertKind = 'rules' | 'court_ready' | 'schedule_change' | 'recap'
export type TiqTournamentAlertStatus = 'draft' | 'queued' | 'sent' | 'cancelled'

export type TiqTournamentRecord = {
  id: string
  name: string
  format: TiqTournamentFormat
  entrantType: TiqTournamentEntrantType
  status: TiqTournamentStatus
  startsOn: string
  locationLabel: string
  directorNotes: string
  entrants: string[]
  results: Record<string, TiqTournamentMatchResult>
  schedule: Record<string, TiqTournamentMatchSchedule>
  contacts: Record<string, TiqTournamentParticipantContact>
  entrantPlayerIds: Record<string, string>
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

export type TiqTournamentDraft = Omit<TiqTournamentRecord, 'id' | 'createdAt' | 'updatedAt' | 'results' | 'schedule' | 'contacts' | 'entrantPlayerIds'>

export type TiqTournamentMatchResult = {
  winner: string
  score: string
  updatedAt: string
}

export type TiqTournamentMatchSchedule = {
  date: string
  time: string
  court: string
  updatedAt: string
}

export type TiqTournamentParticipantContact = {
  name: string
  phone: string
  smsOptIn: boolean
  consentNote: string
  updatedAt: string
}

export type TiqTournamentMatchPreview = {
  id: string
  round: number
  court: number
  label: string
  sideA: string
  sideB: string
  result?: TiqTournamentMatchResult
  schedule?: TiqTournamentMatchSchedule
}

export type TiqTournamentStanding = {
  entrant: string
  played: number
  wins: number
  losses: number
  gamesWon: number
  gamesLost: number
  gameDiff: number
  winPct: number
}

export type TiqTournamentCalendarEvent = {
  id: string
  tournamentId: string
  tournamentName: string
  matchId: string
  label: string
  sideA: string
  sideB: string
  date: string
  time: string
  court: string
  winner: string
}

export type TiqTournamentEntryRecord = {
  id: string
  tournamentId: string
  playerName: string
  email: string
  phone: string
  selfRating: number
  smsOptIn: boolean
  consentNote: string
  status: TiqTournamentEntryStatus
  linkedPlayerId: string
  createdAt: string
  updatedAt: string
}

export type TiqTournamentEntryDraft = {
  tournamentId: string
  playerName: string
  email?: string
  phone?: string
  selfRating?: number
  smsOptIn?: boolean
  consentNote?: string
}

export type TiqTournamentAlertRecord = {
  id: string
  tournamentId: string
  kind: TiqTournamentAlertKind
  channel: 'sms'
  message: string
  siteUrl: string
  recipientCount: number
  optedInCount: number
  status: TiqTournamentAlertStatus
  queuedAt: string
  deliveryNote: string
  createdAt: string
  updatedAt: string
}

export type TiqTournamentAlertDraft = {
  tournamentId: string
  kind: TiqTournamentAlertKind
  message: string
  siteUrl: string
  recipientCount: number
  optedInCount: number
}

export type TiqTournamentPreferenceEventRecord = {
  id: string
  tournamentId: string
  tournamentEntryId: string
  playerName: string
  phone: string
  action: 'opt_in' | 'opt_out'
  source: 'tournament_preferences' | 'director_update' | 'sms_reply'
  consentNote: string
  createdAt: string
}

type TiqTournamentCloudRow = {
  id: string
  name: string
  format: string | null
  entrant_type: string | null
  status: string | null
  starts_on: string | null
  location_label: string | null
  director_notes: string | null
  entrants: string[] | null
  results: Record<string, Partial<TiqTournamentMatchResult>> | null
  schedule: Record<string, Partial<TiqTournamentMatchSchedule>> | null
  contacts: Record<string, Partial<TiqTournamentParticipantContact>> | null
  entrant_player_ids: Record<string, string> | null
  is_public: boolean | null
  created_at: string | null
  updated_at: string | null
}

type TiqTournamentEntryCloudRow = {
  id: string
  tournament_id: string | null
  player_name: string | null
  email: string | null
  phone: string | null
  self_rating: number | null
  sms_opt_in: boolean | null
  consent_note: string | null
  status: string | null
  linked_player_id: string | null
  created_at: string | null
  updated_at: string | null
}

type TiqTournamentAlertCloudRow = {
  id: string
  tournament_id: string | null
  kind: string | null
  channel: string | null
  message: string | null
  site_url: string | null
  recipient_count: number | null
  opted_in_count: number | null
  status: string | null
  queued_at: string | null
  delivery_note: string | null
  created_at: string | null
  updated_at: string | null
}

type TiqTournamentPreferenceEventCloudRow = {
  id: string
  tournament_id: string | null
  tournament_entry_id: string | null
  player_name: string | null
  phone: string | null
  action: string | null
  source: string | null
  consent_note: string | null
  created_at: string | null
}

export type TiqTournamentRegistryLoadResult = {
  data: TiqTournamentRecord[]
  error: Error | null
  source: 'cloud' | 'local'
}

export type TiqTournamentRegistrySaveResult = {
  data: TiqTournamentRecord
  error: Error | null
  source: 'cloud' | 'local'
}

function cleanText(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function cleanPhone(value: string | null | undefined) {
  return cleanText(value).replace(/[^\d+().\-\s]/g, '').replace(/\s+/g, ' ').trim()
}

function cleanEmail(value: string | null | undefined) {
  return cleanText(value).toLowerCase().slice(0, 160)
}

function cleanMultiline(value: string | null | undefined) {
  return (value || '').trim()
}

function normalizeSelfRating(value: number | string | null | undefined) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value || '')
  if (!Number.isFinite(parsed)) return 3.5
  return Math.min(7, Math.max(1, Math.round(parsed * 10) / 10))
}

function normalizeEntrants(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => cleanText(value))
        .filter(Boolean),
    ),
  )
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function buildTournamentId(input: { name: string; startsOn: string }) {
  const base = `${input.name} ${input.startsOn}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return base || `tiq-tournament-${Date.now()}`
}

function normalizeTiqTournamentRecord(record: Partial<TiqTournamentRecord>): TiqTournamentRecord {
  return {
    id: cleanText(record.id),
    name: cleanText(record.name),
    format: normalizeTiqTournamentFormat(record.format),
    entrantType: normalizeTiqTournamentEntrantType(record.entrantType),
    status: normalizeTiqTournamentStatus(record.status),
    startsOn: cleanText(record.startsOn),
    locationLabel: cleanText(record.locationLabel),
    directorNotes: cleanMultiline(record.directorNotes),
    entrants: normalizeEntrants(Array.isArray(record.entrants) ? record.entrants : []),
    results: normalizeTournamentResults(record.results),
    schedule: normalizeTournamentSchedule(record.schedule),
    contacts: normalizeTournamentContacts(record.contacts),
    entrantPlayerIds: normalizeEntrantPlayerIds(record.entrantPlayerIds),
    isPublic: Boolean(record.isPublic),
    createdAt: cleanText(record.createdAt),
    updatedAt: cleanText(record.updatedAt),
  }
}

function mapCloudTournamentRow(row: TiqTournamentCloudRow): TiqTournamentRecord {
  return normalizeTiqTournamentRecord({
    id: row.id,
    name: row.name,
    format: normalizeTiqTournamentFormat(row.format),
    entrantType: normalizeTiqTournamentEntrantType(row.entrant_type),
    status: normalizeTiqTournamentStatus(row.status),
    startsOn: row.starts_on || '',
    locationLabel: row.location_label || '',
    directorNotes: row.director_notes || '',
    entrants: row.entrants || [],
    results: normalizeTournamentResults(row.results || {}),
    schedule: normalizeTournamentSchedule(row.schedule || {}),
    contacts: normalizeTournamentContacts(row.contacts || {}),
    entrantPlayerIds: normalizeEntrantPlayerIds(row.entrant_player_ids || {}),
    isPublic: Boolean(row.is_public),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  })
}

function toCloudTournamentPayload(record: TiqTournamentRecord, userId: string) {
  return {
    id: record.id,
    name: record.name,
    format: record.format,
    entrant_type: record.entrantType,
    status: record.status,
    starts_on: record.startsOn,
    location_label: record.locationLabel,
    director_notes: record.directorNotes,
    entrants: record.entrants,
    results: record.results,
    schedule: record.schedule,
    contacts: record.contacts,
    entrant_player_ids: record.entrantPlayerIds,
    is_public: record.isPublic,
    updated_by_user_id: userId,
    created_by_user_id: userId,
  }
}

function mergeLocalTournamentRecord(record: TiqTournamentRecord) {
  const registry = readTiqTournamentRegistry()
  writeTiqTournamentRegistry([record, ...registry.filter((item) => item.id !== record.id)])
}

export function normalizeTiqTournamentFormat(value: string | null | undefined): TiqTournamentFormat {
  if (value === 'round_robin' || value === 'compass_draw') return value
  return 'single_elimination'
}

export function normalizeTiqTournamentEntrantType(value: string | null | undefined): TiqTournamentEntrantType {
  return value === 'teams' ? 'teams' : 'players'
}

export function normalizeTiqTournamentStatus(value: string | null | undefined): TiqTournamentStatus {
  if (value === 'open' || value === 'scheduled' || value === 'completed') return value
  return 'draft'
}

export function normalizeTiqTournamentEntryStatus(value: string | null | undefined): TiqTournamentEntryStatus {
  if (value === 'approved' || value === 'declined') return value
  return 'pending'
}

export function normalizeTiqTournamentAlertKind(value: string | null | undefined): TiqTournamentAlertKind {
  if (value === 'rules' || value === 'schedule_change' || value === 'recap') return value
  return 'court_ready'
}

export function normalizeTiqTournamentAlertStatus(value: string | null | undefined): TiqTournamentAlertStatus {
  if (value === 'queued' || value === 'sent' || value === 'cancelled') return value
  return 'draft'
}

function mapTournamentEntryRow(row: TiqTournamentEntryCloudRow): TiqTournamentEntryRecord {
  return {
    id: cleanText(row.id),
    tournamentId: cleanText(row.tournament_id),
    playerName: cleanText(row.player_name),
    email: cleanEmail(row.email),
    phone: cleanPhone(row.phone),
    selfRating: normalizeSelfRating(row.self_rating),
    smsOptIn: Boolean(row.sms_opt_in),
    consentNote: cleanText(row.consent_note),
    status: normalizeTiqTournamentEntryStatus(row.status),
    linkedPlayerId: cleanText(row.linked_player_id),
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
  }
}

function mapTournamentAlertRow(row: TiqTournamentAlertCloudRow): TiqTournamentAlertRecord {
  return {
    id: cleanText(row.id),
    tournamentId: cleanText(row.tournament_id),
    kind: normalizeTiqTournamentAlertKind(row.kind),
    channel: 'sms',
    message: cleanMultiline(row.message),
    siteUrl: cleanText(row.site_url),
    recipientCount: Math.max(0, Number(row.recipient_count || 0)),
    optedInCount: Math.max(0, Number(row.opted_in_count || 0)),
    status: normalizeTiqTournamentAlertStatus(row.status),
    queuedAt: cleanText(row.queued_at),
    deliveryNote: cleanText(row.delivery_note),
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
  }
}

function mapTournamentPreferenceEventRow(row: TiqTournamentPreferenceEventCloudRow): TiqTournamentPreferenceEventRecord {
  return {
    id: cleanText(row.id),
    tournamentId: cleanText(row.tournament_id),
    tournamentEntryId: cleanText(row.tournament_entry_id),
    playerName: cleanText(row.player_name),
    phone: cleanPhone(row.phone),
    action: row.action === 'opt_in' ? 'opt_in' : 'opt_out',
    source: row.source === 'director_update' || row.source === 'sms_reply' ? row.source : 'tournament_preferences',
    consentNote: cleanText(row.consent_note),
    createdAt: cleanText(row.created_at),
  }
}

export function parseTournamentEntrantsInput(value: string) {
  return normalizeEntrants(
    value
      .split('\n')
      .flatMap((line) => line.split(','))
      .map((item) => item.trim()),
  )
}

export function readTiqTournamentRegistry(): TiqTournamentRecord[] {
  if (typeof window === 'undefined') return []

  const parsed = safeJsonParse<TiqTournamentRecord[]>(
    window.localStorage.getItem(TIQ_TOURNAMENT_REGISTRY_STORAGE_KEY),
  )

  if (!Array.isArray(parsed)) return []

  return parsed
    .filter((record) => record && typeof record === 'object')
    .map((record): TiqTournamentRecord => normalizeTiqTournamentRecord(record))
    .filter((record) => record.id && record.name)
    .sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return bTime - aTime
    })
}

export async function loadTiqTournamentRegistry(userId?: string | null): Promise<TiqTournamentRegistryLoadResult> {
  const localRecords = readTiqTournamentRegistry()
  if (!userId) return { data: localRecords, error: null, source: 'local' }

  const result = await supabase
    .from('tiq_tournaments')
    .select('id,name,format,entrant_type,status,starts_on,location_label,director_notes,entrants,results,schedule,contacts,entrant_player_ids,is_public,created_at,updated_at')
    .order('updated_at', { ascending: false })

  if (result.error) {
    return { data: localRecords, error: new Error(result.error.message), source: 'local' }
  }

  const cloudRecords = ((result.data || []) as TiqTournamentCloudRow[]).map(mapCloudTournamentRow)
  cloudRecords.forEach(mergeLocalTournamentRecord)
  return { data: cloudRecords.length ? cloudRecords : localRecords, error: null, source: 'cloud' }
}

export async function loadTiqTournamentRecord(id: string): Promise<{
  data: TiqTournamentRecord | null
  error: Error | null
  source: 'cloud' | 'local' | 'none'
}> {
  const cleanId = cleanText(id)
  const localRecord = readTiqTournamentRegistry().find((record) => record.id === cleanId) || null
  if (!cleanId) return { data: null, error: null, source: 'none' }

  const result = await supabase
    .from('tiq_tournaments')
    .select('id,name,format,entrant_type,status,starts_on,location_label,director_notes,entrants,results,schedule,contacts,entrant_player_ids,is_public,created_at,updated_at')
    .eq('id', cleanId)
    .maybeSingle()

  if (result.error) {
    return {
      data: localRecord,
      error: new Error(result.error.message),
      source: localRecord ? 'local' : 'none',
    }
  }

  if (!result.data) {
    return { data: localRecord, error: null, source: localRecord ? 'local' : 'none' }
  }

  const record = mapCloudTournamentRow(result.data as TiqTournamentCloudRow)
  mergeLocalTournamentRecord(record)
  return { data: record, error: null, source: 'cloud' }
}

export function writeTiqTournamentRegistry(records: TiqTournamentRecord[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(TIQ_TOURNAMENT_REGISTRY_STORAGE_KEY, JSON.stringify(records))
}

export function upsertTiqTournamentRecord(draft: TiqTournamentDraft, existingId?: string) {
  const registry = readTiqTournamentRegistry()
  const now = new Date().toISOString()
  const normalizedDraft: TiqTournamentDraft = {
    name: cleanText(draft.name),
    format: normalizeTiqTournamentFormat(draft.format),
    entrantType: normalizeTiqTournamentEntrantType(draft.entrantType),
    status: normalizeTiqTournamentStatus(draft.status),
    startsOn: cleanText(draft.startsOn),
    locationLabel: cleanText(draft.locationLabel),
    directorNotes: cleanMultiline(draft.directorNotes),
    entrants: normalizeEntrants(draft.entrants),
    isPublic: Boolean(draft.isPublic),
  }
  const nextId = cleanText(existingId) || buildTournamentId(normalizedDraft)
  const existing = registry.find((record) => record.id === nextId)
  const nextRecord: TiqTournamentRecord = {
    ...normalizedDraft,
    id: nextId,
    results: keepKnownTournamentResults(existing?.results || {}, normalizedDraft),
    schedule: keepKnownTournamentSchedule(existing?.schedule || {}, normalizedDraft),
    contacts: keepKnownTournamentContacts(existing?.contacts || {}, normalizedDraft.entrants),
    entrantPlayerIds: keepKnownEntrantPlayerIds(existing?.entrantPlayerIds || {}, normalizedDraft.entrants),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }

  const nextRegistry = [nextRecord, ...registry.filter((record) => record.id !== nextId)]
  writeTiqTournamentRegistry(nextRegistry)
  return nextRecord
}

export async function saveTiqTournamentRecord(
  record: TiqTournamentRecord,
  userId?: string | null,
): Promise<TiqTournamentRegistrySaveResult> {
  mergeLocalTournamentRecord(record)

  if (!userId) {
    return { data: record, error: null, source: 'local' }
  }

  const result = await supabase
    .from('tiq_tournaments')
    .upsert(toCloudTournamentPayload(record, userId), { onConflict: 'id' })
    .select('id,name,format,entrant_type,status,starts_on,location_label,director_notes,entrants,results,schedule,contacts,entrant_player_ids,is_public,created_at,updated_at')
    .maybeSingle()

  if (result.error) {
    return { data: record, error: new Error(result.error.message), source: 'local' }
  }

  const nextRecord = mapCloudTournamentRow(result.data as TiqTournamentCloudRow)
  mergeLocalTournamentRecord(nextRecord)
  return { data: nextRecord, error: null, source: 'cloud' }
}

export async function upsertTiqTournamentRecordForUser(
  draft: TiqTournamentDraft,
  existingId?: string,
  userId?: string | null,
): Promise<TiqTournamentRegistrySaveResult> {
  const saved = upsertTiqTournamentRecord(draft, existingId)
  return saveTiqTournamentRecord(saved, userId)
}

export async function submitTiqTournamentEntry(draft: TiqTournamentEntryDraft) {
  const payload = {
    tournament_id: cleanText(draft.tournamentId),
    player_name: cleanText(draft.playerName),
    email: cleanEmail(draft.email),
    phone: cleanPhone(draft.phone),
    self_rating: normalizeSelfRating(draft.selfRating),
    sms_opt_in: Boolean(draft.smsOptIn),
    consent_note: cleanText(draft.consentNote),
    status: 'pending',
  }

  if (!payload.tournament_id || !payload.player_name) {
    return { data: null, error: new Error('Enter your name before submitting.'), source: 'cloud' as const }
  }

  const result = await supabase
    .from('tiq_tournament_entries')
    .insert(payload)
    .select('id,tournament_id,player_name,email,phone,self_rating,sms_opt_in,consent_note,status,linked_player_id,created_at,updated_at')
    .maybeSingle()

  if (result.error) {
    return { data: null, error: new Error(result.error.message), source: 'cloud' as const }
  }

  return { data: mapTournamentEntryRow(result.data as TiqTournamentEntryCloudRow), error: null, source: 'cloud' as const }
}

export async function loadTiqTournamentEntriesForUser(tournamentId: string) {
  const cleanId = cleanText(tournamentId)
  if (!cleanId) return { data: [], error: null, source: 'cloud' as const }

  const result = await supabase
    .from('tiq_tournament_entries')
    .select('id,tournament_id,player_name,email,phone,self_rating,sms_opt_in,consent_note,status,linked_player_id,created_at,updated_at')
    .eq('tournament_id', cleanId)
    .order('created_at', { ascending: false })

  if (result.error) {
    return { data: [], error: new Error(result.error.message), source: 'cloud' as const }
  }

  return { data: ((result.data || []) as TiqTournamentEntryCloudRow[]).map(mapTournamentEntryRow), error: null, source: 'cloud' as const }
}

export async function updateTiqTournamentEntryStatus(
  entryId: string,
  status: TiqTournamentEntryStatus,
  linkedPlayerId?: string | null,
) {
  const payload = {
    status: normalizeTiqTournamentEntryStatus(status),
    linked_player_id: cleanText(linkedPlayerId || '') || null,
    updated_at: new Date().toISOString(),
  }

  const result = await supabase
    .from('tiq_tournament_entries')
    .update(payload)
    .eq('id', cleanText(entryId))
    .select('id,tournament_id,player_name,email,phone,self_rating,sms_opt_in,consent_note,status,linked_player_id,created_at,updated_at')
    .maybeSingle()

  if (result.error) {
    return { data: null, error: new Error(result.error.message), source: 'cloud' as const }
  }

  return { data: result.data ? mapTournamentEntryRow(result.data as TiqTournamentEntryCloudRow) : null, error: null, source: 'cloud' as const }
}

export async function loadTiqTournamentAlertRecordsForUser(tournamentId: string) {
  const cleanId = cleanText(tournamentId)
  if (!cleanId) return { data: [] as TiqTournamentAlertRecord[], error: null, source: 'cloud' as const }

  const result = await supabase
    .from('tiq_tournament_alerts')
    .select('id,tournament_id,kind,channel,message,site_url,recipient_count,opted_in_count,status,queued_at,delivery_note,created_at,updated_at')
    .eq('tournament_id', cleanId)
    .order('created_at', { ascending: false })

  if (result.error) {
    return { data: [] as TiqTournamentAlertRecord[], error: new Error(result.error.message), source: 'cloud' as const }
  }

  return { data: ((result.data || []) as TiqTournamentAlertCloudRow[]).map(mapTournamentAlertRow), error: null, source: 'cloud' as const }
}

export async function saveTiqTournamentAlertRecordForUser(draft: TiqTournamentAlertDraft, userId?: string | null) {
  const payload = {
    tournament_id: cleanText(draft.tournamentId),
    kind: normalizeTiqTournamentAlertKind(draft.kind),
    channel: 'sms',
    message: cleanMultiline(draft.message),
    site_url: cleanText(draft.siteUrl) || 'https://www.tenaceiq.com',
    recipient_count: Math.max(0, Math.round(Number(draft.recipientCount || 0))),
    opted_in_count: Math.max(0, Math.round(Number(draft.optedInCount || 0))),
    status: 'draft',
    created_by_user_id: userId || null,
  }

  if (!payload.tournament_id || !payload.message) {
    return { data: null, error: new Error('Draft the tournament alert before saving it.'), source: 'cloud' as const }
  }

  const result = await supabase
    .from('tiq_tournament_alerts')
    .insert(payload)
    .select('id,tournament_id,kind,channel,message,site_url,recipient_count,opted_in_count,status,queued_at,delivery_note,created_at,updated_at')
    .maybeSingle()

  if (result.error) {
    return { data: null, error: new Error(result.error.message), source: 'cloud' as const }
  }

  return { data: mapTournamentAlertRow(result.data as TiqTournamentAlertCloudRow), error: null, source: 'cloud' as const }
}

export async function queueTiqTournamentAlertRecordForUser(alertId: string) {
  const now = new Date().toISOString()
  const result = await supabase
    .from('tiq_tournament_alerts')
    .update({
      status: 'queued',
      queued_at: now,
      delivery_note: 'Queued for delivery after sender registration, opt-out handling, and provider checks are enabled.',
      updated_at: now,
    })
    .eq('id', cleanText(alertId))
    .eq('status', 'draft')
    .select('id,tournament_id,kind,channel,message,site_url,recipient_count,opted_in_count,status,queued_at,delivery_note,created_at,updated_at')
    .maybeSingle()

  if (result.error) {
    return { data: null, error: new Error(result.error.message), source: 'cloud' as const }
  }

  return { data: result.data ? mapTournamentAlertRow(result.data as TiqTournamentAlertCloudRow) : null, error: null, source: 'cloud' as const }
}

export async function loadTiqTournamentPreferenceEventsForUser(tournamentId: string) {
  const cleanId = cleanText(tournamentId)
  if (!cleanId) return { data: [] as TiqTournamentPreferenceEventRecord[], error: null, source: 'cloud' as const }

  const result = await supabase
    .from('tiq_tournament_preference_events')
    .select('id,tournament_id,tournament_entry_id,player_name,phone,action,source,consent_note,created_at')
    .eq('tournament_id', cleanId)
    .order('created_at', { ascending: false })
    .limit(12)

  if (result.error) {
    return { data: [] as TiqTournamentPreferenceEventRecord[], error: new Error(result.error.message), source: 'cloud' as const }
  }

  return {
    data: ((result.data || []) as TiqTournamentPreferenceEventCloudRow[]).map(mapTournamentPreferenceEventRow),
    error: null,
    source: 'cloud' as const,
  }
}

export function deleteTiqTournamentRecord(id: string) {
  writeTiqTournamentRegistry(readTiqTournamentRegistry().filter((record) => record.id !== cleanText(id)))
}

export async function deleteTiqTournamentRecordForUser(id: string, userId?: string | null) {
  deleteTiqTournamentRecord(id)
  if (!userId) return { error: null, source: 'local' as const }

  const result = await supabase
    .from('tiq_tournaments')
    .delete()
    .eq('id', cleanText(id))

  return {
    error: result.error ? new Error(result.error.message) : null,
    source: result.error ? 'local' as const : 'cloud' as const,
  }
}

export function updateTiqTournamentMatchResult(input: {
  tournamentId: string
  matchId: string
  winner: string
  score?: string
}) {
  const registry = readTiqTournamentRegistry()
  const tournamentId = cleanText(input.tournamentId)
  const matchId = cleanText(input.matchId)
  const winner = cleanText(input.winner)
  if (!tournamentId || !matchId || !winner) return null

  const index = registry.findIndex((record) => record.id === tournamentId)
  if (index < 0) return null

  const record = registry[index]
  const matches = buildTournamentPreview(record)
  const match = matches.find((item) => item.id === matchId)
  if (!match || (winner !== match.sideA && winner !== match.sideB)) return null

  const nextRecord: TiqTournamentRecord = {
    ...record,
    status: record.status === 'draft' ? 'scheduled' : record.status,
    results: {
      ...record.results,
      [matchId]: {
        winner,
        score: cleanText(input.score),
        updatedAt: new Date().toISOString(),
      },
    },
    updatedAt: new Date().toISOString(),
  }
  nextRecord.results = pruneInvalidTournamentResults(nextRecord)
  const nextRegistry = [...registry]
  nextRegistry[index] = nextRecord
  writeTiqTournamentRegistry(nextRegistry)
  return nextRecord
}

export async function updateTiqTournamentMatchResultForUser(
  input: {
    tournamentId: string
    matchId: string
    winner: string
    score?: string
  },
  userId?: string | null,
) {
  const updated = updateTiqTournamentMatchResult(input)
  if (!updated) return null
  await saveTiqTournamentRecord(updated, userId)
  return updated
}

export function clearTiqTournamentMatchResult(tournamentId: string, matchId: string) {
  const registry = readTiqTournamentRegistry()
  const index = registry.findIndex((record) => record.id === cleanText(tournamentId))
  if (index < 0) return null

  const record = registry[index]
  const nextResults = { ...record.results }
  delete nextResults[cleanText(matchId)]

  const nextRecord: TiqTournamentRecord = {
    ...record,
    results: nextResults,
    updatedAt: new Date().toISOString(),
  }
  nextRecord.results = pruneInvalidTournamentResults(nextRecord)
  const nextRegistry = [...registry]
  nextRegistry[index] = nextRecord
  writeTiqTournamentRegistry(nextRegistry)
  return nextRecord
}

export async function clearTiqTournamentMatchResultForUser(tournamentId: string, matchId: string, userId?: string | null) {
  const updated = clearTiqTournamentMatchResult(tournamentId, matchId)
  if (!updated) return null
  await saveTiqTournamentRecord(updated, userId)
  return updated
}

export function updateTiqTournamentMatchSchedule(input: {
  tournamentId: string
  matchId: string
  date?: string
  time?: string
  court?: string
}) {
  const registry = readTiqTournamentRegistry()
  const tournamentId = cleanText(input.tournamentId)
  const matchId = cleanText(input.matchId)
  if (!tournamentId || !matchId) return null

  const index = registry.findIndex((record) => record.id === tournamentId)
  if (index < 0) return null

  const record = registry[index]
  const matches = buildTournamentPreview(record)
  if (!matches.some((item) => item.id === matchId)) return null

  const nextSchedule = { ...record.schedule }
  const schedule = {
    date: cleanText(input.date),
    time: cleanText(input.time),
    court: cleanText(input.court),
    updatedAt: new Date().toISOString(),
  }

  if (schedule.date || schedule.time || schedule.court) {
    nextSchedule[matchId] = schedule
  } else {
    delete nextSchedule[matchId]
  }

  const nextRecord: TiqTournamentRecord = {
    ...record,
    status: record.status === 'draft' ? 'scheduled' : record.status,
    schedule: keepKnownTournamentSchedule(nextSchedule, record),
    updatedAt: new Date().toISOString(),
  }

  const nextRegistry = [...registry]
  nextRegistry[index] = nextRecord
  writeTiqTournamentRegistry(nextRegistry)
  return nextRecord
}

export async function updateTiqTournamentMatchScheduleForUser(
  input: {
    tournamentId: string
    matchId: string
    date?: string
    time?: string
    court?: string
  },
  userId?: string | null,
) {
  const updated = updateTiqTournamentMatchSchedule(input)
  if (!updated) return null
  await saveTiqTournamentRecord(updated, userId)
  return updated
}

export function updateTiqTournamentParticipantContact(input: {
  tournamentId: string
  entrantName: string
  phone?: string
  smsOptIn?: boolean
  consentNote?: string
}) {
  const registry = readTiqTournamentRegistry()
  const tournamentId = cleanText(input.tournamentId)
  const entrantName = cleanText(input.entrantName)
  if (!tournamentId || !entrantName) return null

  const index = registry.findIndex((record) => record.id === tournamentId)
  if (index < 0) return null

  const record = registry[index]
  if (!record.entrants.includes(entrantName)) return null

  const current = record.contacts[entrantName]
  const nextContact: TiqTournamentParticipantContact = {
    name: entrantName,
    phone: cleanPhone(input.phone ?? current?.phone ?? ''),
    smsOptIn: Boolean(input.smsOptIn ?? current?.smsOptIn),
    consentNote: cleanText(input.consentNote ?? current?.consentNote ?? ''),
    updatedAt: new Date().toISOString(),
  }

  const nextRecord: TiqTournamentRecord = {
    ...record,
    contacts: {
      ...record.contacts,
      [entrantName]: nextContact,
    },
    updatedAt: new Date().toISOString(),
  }

  const nextRegistry = [...registry]
  nextRegistry[index] = nextRecord
  writeTiqTournamentRegistry(nextRegistry)
  return nextRecord
}

export async function updateTiqTournamentParticipantContactForUser(
  input: {
    tournamentId: string
    entrantName: string
    phone?: string
    smsOptIn?: boolean
    consentNote?: string
  },
  userId?: string | null,
) {
  const updated = updateTiqTournamentParticipantContact(input)
  if (!updated) return null
  await saveTiqTournamentRecord(updated, userId)
  return updated
}

export function updateTiqTournamentEntrantPlayerIds(
  tournamentId: string,
  entrantPlayerIds: Record<string, string>,
) {
  const registry = readTiqTournamentRegistry()
  const index = registry.findIndex((record) => record.id === cleanText(tournamentId))
  if (index < 0) return null

  const record = registry[index]
  const nextRecord: TiqTournamentRecord = {
    ...record,
    entrantPlayerIds: {
      ...record.entrantPlayerIds,
      ...keepKnownEntrantPlayerIds(entrantPlayerIds, record.entrants),
    },
    updatedAt: new Date().toISOString(),
  }

  const nextRegistry = [...registry]
  nextRegistry[index] = nextRecord
  writeTiqTournamentRegistry(nextRegistry)
  return nextRecord
}

export async function updateTiqTournamentEntrantPlayerIdsForUser(
  tournamentId: string,
  entrantPlayerIds: Record<string, string>,
  userId?: string | null,
) {
  const updated = updateTiqTournamentEntrantPlayerIds(tournamentId, entrantPlayerIds)
  if (!updated) return null
  await saveTiqTournamentRecord(updated, userId)
  return updated
}

export function buildTiqTournamentAlertDraft(input: {
  record: Pick<TiqTournamentRecord, 'name' | 'directorNotes'>
  kind: 'rules' | 'court_ready' | 'schedule_change' | 'recap'
  body?: string
  siteUrl?: string
  preferencesUrl?: string
}) {
  const siteUrl = cleanText(input.siteUrl) || 'https://www.tenaceiq.com'
  const preferencesUrl = cleanText(input.preferencesUrl) || `${siteUrl.replace(/\/$/, '')}/preferences`
  const base = cleanText(input.body) || buildDefaultTournamentAlertBody(input.kind, input.record)
  return [
    `TenAceIQ ${input.record.name}: ${base}`,
    `View details: ${siteUrl}`,
    `Manage alerts: ${preferencesUrl}`,
    'Reply STOP to opt out.',
  ].join(' ')
}

function buildDefaultTournamentAlertBody(
  kind: 'rules' | 'court_ready' | 'schedule_change' | 'recap',
  record: Pick<TiqTournamentRecord, 'directorNotes'>,
) {
  if (kind === 'rules') return record.directorNotes || 'Tournament rules and site notes are posted.'
  if (kind === 'court_ready') return 'Your court assignment is ready. Please check in with the tournament desk.'
  if (kind === 'schedule_change') return 'A match schedule update is available.'
  return 'Tournament results have been updated.'
}

export function getTournamentLimitSummary(isFullCourt: boolean) {
  return isFullCourt ? 'Unlimited tournaments with Full-Court' : 'League includes one tournament room'
}

export function buildSingleEliminationPreview(
  entrants: string[],
  results: Record<string, TiqTournamentMatchResult> = {},
  schedule: Record<string, TiqTournamentMatchSchedule> = {},
): TiqTournamentMatchPreview[] {
  const field = normalizeEntrants(entrants)
  if (field.length < 2) return []

  const bracketSize = Math.pow(2, Math.ceil(Math.log2(field.length)))
  const seeded = [...field, ...Array.from({ length: bracketSize - field.length }, () => 'Bye')]
  const matches: TiqTournamentMatchPreview[] = []
  const winnersByMatch = new Map<string, string>()

  for (let index = 0; index < bracketSize / 2; index += 1) {
    const id = buildMatchId(1, index + 1)
    const sideA = seeded[index]
    const sideB = seeded[bracketSize - 1 - index]
    const result = results[id]
    const byeWinner = sideA === 'Bye' ? sideB : sideB === 'Bye' ? sideA : ''
    const winner = byeWinner || result?.winner || ''
    if (winner) winnersByMatch.set(id, winner)
    matches.push({
      id,
      round: 1,
      court: index + 1,
      label: 'Round 1',
      sideA,
      sideB,
      result: result || (byeWinner ? { winner: byeWinner, score: 'Bye', updatedAt: '' } : undefined),
      schedule: schedule[id],
    })
  }

  let remaining = bracketSize / 4
  let round = 2
  while (remaining >= 1) {
    for (let index = 0; index < remaining; index += 1) {
      const id = buildMatchId(round, index + 1)
      const previousLeft = buildMatchId(round - 1, index * 2 + 1)
      const previousRight = buildMatchId(round - 1, index * 2 + 2)
      const sideA = winnersByMatch.get(previousLeft) || `Winner R${round - 1}.${index * 2 + 1}`
      const sideB = winnersByMatch.get(previousRight) || `Winner R${round - 1}.${index * 2 + 2}`
      const result = results[id]
      if (result?.winner && result.winner === sideA || result?.winner && result.winner === sideB) {
        winnersByMatch.set(id, result.winner)
      }
      matches.push({
        id,
        round,
        court: index + 1,
        label: remaining === 1 ? 'Final' : `Round ${round}`,
        sideA,
        sideB,
        result,
        schedule: schedule[id],
      })
    }
    remaining /= 2
    round += 1
  }

  return matches
}

export function buildRoundRobinPreview(
  entrants: string[],
  results: Record<string, TiqTournamentMatchResult> = {},
  schedule: Record<string, TiqTournamentMatchSchedule> = {},
): TiqTournamentMatchPreview[] {
  const field = normalizeEntrants(entrants)
  if (field.length < 2) return []

  const rotating = field.length % 2 === 0 ? [...field] : [...field, 'Bye']
  const rounds = rotating.length - 1
  const half = rotating.length / 2
  const matches: TiqTournamentMatchPreview[] = []

  for (let round = 1; round <= rounds; round += 1) {
    for (let index = 0; index < half; index += 1) {
      const sideA = rotating[index]
      const sideB = rotating[rotating.length - 1 - index]
      if (sideA !== 'Bye' && sideB !== 'Bye') {
        const court = index + 1
        const id = buildMatchId(round, court)
        matches.push({
          id,
          round,
          court,
          label: `Round ${round}`,
          sideA,
          sideB,
          result: results[id],
          schedule: schedule[id],
        })
      }
    }
    rotating.splice(1, 0, rotating.pop() || '')
  }

  return matches
}

export function buildTournamentPreview(record: Pick<TiqTournamentRecord, 'format' | 'entrants'> & { results?: Record<string, TiqTournamentMatchResult>, schedule?: Record<string, TiqTournamentMatchSchedule> }) {
  if (record.format === 'round_robin') return buildRoundRobinPreview(record.entrants, record.results, record.schedule)
  return buildSingleEliminationPreview(record.entrants, record.results, record.schedule)
}

export function summarizeTournamentResults(record: Pick<TiqTournamentRecord, 'format' | 'entrants' | 'results'>) {
  const matches = buildTournamentPreview(record)
  const playableMatches = matches.filter((match) => match.sideA !== 'Bye' && match.sideB !== 'Bye')
  const completedMatches = playableMatches.filter((match) => Boolean(match.result?.winner))
  const champion =
    matches.find((match) => match.label === 'Final')?.result?.winner ||
    (playableMatches.length === 1 ? playableMatches[0]?.result?.winner || '' : '')

  return {
    totalMatches: playableMatches.length,
    completedMatches: completedMatches.length,
    openMatches: Math.max(0, playableMatches.length - completedMatches.length),
    champion,
  }
}

export function buildTournamentScheduleEvents(records: TiqTournamentRecord[]): TiqTournamentCalendarEvent[] {
  return records
    .flatMap((record) =>
      buildTournamentPreview(record)
        .filter((match) => match.schedule?.date || match.schedule?.time || match.schedule?.court)
        .map((match) => ({
          id: `${record.id}:${match.id}`,
          tournamentId: record.id,
          tournamentName: record.name,
          matchId: match.id,
          label: match.label,
          sideA: match.sideA,
          sideB: match.sideB,
          date: match.schedule?.date || '',
          time: match.schedule?.time || '',
          court: match.schedule?.court || '',
          winner: match.result?.winner || '',
        })),
    )
    .sort((left, right) =>
      left.date.localeCompare(right.date) ||
      left.time.localeCompare(right.time) ||
      left.tournamentName.localeCompare(right.tournamentName) ||
      left.matchId.localeCompare(right.matchId),
    )
}

export function buildRoundRobinStandings(record: Pick<TiqTournamentRecord, 'format' | 'entrants' | 'results'>): TiqTournamentStanding[] {
  const entrants = normalizeEntrants(record.entrants)
  const rows = new Map<string, TiqTournamentStanding>(
    entrants.map((entrant) => [
      entrant,
      { entrant, played: 0, wins: 0, losses: 0, gamesWon: 0, gamesLost: 0, gameDiff: 0, winPct: 0 },
    ]),
  )

  for (const match of buildRoundRobinPreview(entrants, record.results)) {
    const winner = cleanText(match.result?.winner)
    if (!winner) continue
    const loser = winner === match.sideA ? match.sideB : winner === match.sideB ? match.sideA : ''
    if (!loser) continue

    const winnerRow = rows.get(winner)
    const loserRow = rows.get(loser)
    if (!winnerRow || !loserRow) continue

    winnerRow.played += 1
    winnerRow.wins += 1
    loserRow.played += 1
    loserRow.losses += 1

    const games = parseTournamentScoreGames(match.result?.score || '')
    const winnerGames = winner === match.sideA ? games.sideA : games.sideB
    const loserGames = winner === match.sideA ? games.sideB : games.sideA
    winnerRow.gamesWon += winnerGames
    winnerRow.gamesLost += loserGames
    loserRow.gamesWon += loserGames
    loserRow.gamesLost += winnerGames
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      gameDiff: row.gamesWon - row.gamesLost,
      winPct: row.played ? Math.round((row.wins / row.played) * 100) : 0,
    }))
    .sort((left, right) =>
      right.wins - left.wins ||
      left.losses - right.losses ||
      right.gameDiff - left.gameDiff ||
      right.gamesWon - left.gamesWon ||
      right.winPct - left.winPct ||
      left.entrant.localeCompare(right.entrant),
    )
}

function parseTournamentScoreGames(score: string) {
  return (cleanText(score).match(/\d+\s*-\s*\d+/g) || []).reduce(
    (total, setText) => {
      const [leftRaw, rightRaw] = setText.split('-')
      const sideA = Number.parseInt(leftRaw.trim(), 10)
      const sideB = Number.parseInt(rightRaw.trim(), 10)
      if (!Number.isFinite(sideA) || !Number.isFinite(sideB)) return total
      return {
        sideA: total.sideA + sideA,
        sideB: total.sideB + sideB,
      }
    },
    { sideA: 0, sideB: 0 },
  )
}

function buildMatchId(round: number, court: number) {
  return `r${round}-m${court}`
}

function normalizeTournamentResults(value: unknown): Record<string, TiqTournamentMatchResult> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.entries(value as Record<string, Partial<TiqTournamentMatchResult>>).reduce<
    Record<string, TiqTournamentMatchResult>
  >((nextResults, [key, result]) => {
    const matchId = cleanText(key)
    const normalizedResult = {
      winner: cleanText(result?.winner),
      score: cleanText(result?.score),
      updatedAt: cleanText(result?.updatedAt),
    }

    if (matchId && normalizedResult.winner) {
      nextResults[matchId] = normalizedResult
    }

    return nextResults
  }, {})
}

function normalizeTournamentSchedule(value: unknown): Record<string, TiqTournamentMatchSchedule> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.entries(value as Record<string, Partial<TiqTournamentMatchSchedule>>).reduce<
    Record<string, TiqTournamentMatchSchedule>
  >((nextSchedule, [key, schedule]) => {
    const matchId = cleanText(key)
    const normalizedSchedule = {
      date: cleanText(schedule?.date),
      time: cleanText(schedule?.time),
      court: cleanText(schedule?.court),
      updatedAt: cleanText(schedule?.updatedAt),
    }

    if (matchId && (normalizedSchedule.date || normalizedSchedule.time || normalizedSchedule.court)) {
      nextSchedule[matchId] = normalizedSchedule
    }

    return nextSchedule
  }, {})
}

function normalizeTournamentContacts(value: unknown): Record<string, TiqTournamentParticipantContact> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.entries(value as Record<string, Partial<TiqTournamentParticipantContact>>).reduce<
    Record<string, TiqTournamentParticipantContact>
  >((nextContacts, [key, contact]) => {
    const entrantName = cleanText(contact?.name || key)
    const normalizedContact = {
      name: entrantName,
      phone: cleanPhone(contact?.phone),
      smsOptIn: Boolean(contact?.smsOptIn),
      consentNote: cleanText(contact?.consentNote),
      updatedAt: cleanText(contact?.updatedAt),
    }

    if (entrantName && (normalizedContact.phone || normalizedContact.smsOptIn || normalizedContact.consentNote)) {
      nextContacts[entrantName] = normalizedContact
    }

    return nextContacts
  }, {})
}

function normalizeEntrantPlayerIds(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.entries(value as Record<string, string>).reduce<Record<string, string>>((nextIds, [entrant, playerId]) => {
    const cleanEntrant = cleanText(entrant)
    const cleanPlayerId = cleanText(playerId)
    if (cleanEntrant && cleanPlayerId) nextIds[cleanEntrant] = cleanPlayerId
    return nextIds
  }, {})
}

function keepKnownTournamentResults(
  results: Record<string, TiqTournamentMatchResult>,
  draft: TiqTournamentDraft,
) {
  const knownIds = new Set(buildTournamentPreview({ ...draft, results: {} }).map((match) => match.id))
  return Object.fromEntries(Object.entries(results).filter(([id]) => knownIds.has(id)))
}

function keepKnownTournamentSchedule(
  schedule: Record<string, TiqTournamentMatchSchedule>,
  draft: Pick<TiqTournamentRecord, 'format' | 'entrants'>,
) {
  const knownIds = new Set(buildTournamentPreview({ ...draft, results: {}, schedule: {} }).map((match) => match.id))
  return Object.fromEntries(Object.entries(schedule).filter(([id]) => knownIds.has(id)))
}

function keepKnownTournamentContacts(
  contacts: Record<string, TiqTournamentParticipantContact>,
  entrants: string[],
) {
  const knownEntrants = new Set(normalizeEntrants(entrants))
  return Object.fromEntries(Object.entries(contacts).filter(([entrant]) => knownEntrants.has(entrant)))
}

function keepKnownEntrantPlayerIds(
  entrantPlayerIds: Record<string, string>,
  entrants: string[],
) {
  const knownEntrants = new Set(normalizeEntrants(entrants))
  return Object.fromEntries(
    Object.entries(normalizeEntrantPlayerIds(entrantPlayerIds)).filter(([entrant]) => knownEntrants.has(entrant)),
  )
}

function pruneInvalidTournamentResults(record: Pick<TiqTournamentRecord, 'format' | 'entrants' | 'results'>) {
  const pruned: Record<string, TiqTournamentMatchResult> = {}
  const candidates = { ...record.results }
  const matchIds = Object.keys(candidates)

  for (let pass = 0; pass < matchIds.length; pass += 1) {
    let changed = false
    const preview = buildTournamentPreview({ ...record, results: pruned })

    for (const match of preview) {
      const result = candidates[match.id]
      if (!result || pruned[match.id]) continue
      const sidesKnown = !match.sideA.startsWith('Winner ') && !match.sideB.startsWith('Winner ')
      const winnerValid = result.winner === match.sideA || result.winner === match.sideB
      if (sidesKnown && winnerValid) {
        pruned[match.id] = result
        changed = true
      }
    }

    if (!changed) break
  }

  return pruned
}
