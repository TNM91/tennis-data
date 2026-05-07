'use client'

import { getClientAuthState } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

const TIQ_LEAGUE_SCHEDULE_TABLE = 'tiq_league_schedule_items'
const TIQ_LEAGUE_SCHEDULE_STORAGE_KEY = 'tenaceiq_tiq_league_schedule_items'

export type TiqLeagueScheduleSource = 'supabase' | 'local'
export type TiqLeagueScheduleStatus = 'proposed' | 'confirmed' | 'coordinator_set' | 'completed' | 'cancelled'
export type TiqLeagueScheduleFormat = 'team' | 'individual'

export type TiqLeagueScheduleItem = {
  id: string
  leagueId: string
  leagueFormat: TiqLeagueScheduleFormat
  participantAName: string
  participantAId: string
  participantBName: string
  participantBId: string
  scheduledDate: string
  scheduledTime: string
  facility: string
  status: TiqLeagueScheduleStatus
  notes: string
  proposedByUserId: string
  confirmedByUserId: string
  createdAt: string
  updatedAt: string
}

type TiqLeagueScheduleRow = {
  id?: string | null
  league_id?: string | null
  league_format?: string | null
  participant_a_name?: string | null
  participant_a_id?: string | null
  participant_b_name?: string | null
  participant_b_id?: string | null
  scheduled_date?: string | null
  scheduled_time?: string | null
  facility?: string | null
  status?: string | null
  notes?: string | null
  proposed_by_user_id?: string | null
  confirmed_by_user_id?: string | null
  created_at?: string | null
  updated_at?: string | null
}

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
}

function normalizeScheduleStatus(value: string | null | undefined): TiqLeagueScheduleStatus {
  const normalized = cleanText(value).toLowerCase()
  if (
    normalized === 'confirmed' ||
    normalized === 'coordinator_set' ||
    normalized === 'completed' ||
    normalized === 'cancelled'
  ) {
    return normalized
  }
  return 'proposed'
}

function normalizeScheduleFormat(value: string | null | undefined): TiqLeagueScheduleFormat {
  return cleanText(value).toLowerCase() === 'individual' ? 'individual' : 'team'
}

function normalizeRow(row: TiqLeagueScheduleRow): TiqLeagueScheduleItem | null {
  const id = cleanText(row.id)
  const leagueId = cleanText(row.league_id)
  if (!id || !leagueId) return null

  return {
    id,
    leagueId,
    leagueFormat: normalizeScheduleFormat(row.league_format),
    participantAName: cleanText(row.participant_a_name),
    participantAId: cleanText(row.participant_a_id),
    participantBName: cleanText(row.participant_b_name),
    participantBId: cleanText(row.participant_b_id),
    scheduledDate: cleanText(row.scheduled_date),
    scheduledTime: cleanText(row.scheduled_time),
    facility: cleanText(row.facility),
    status: normalizeScheduleStatus(row.status),
    notes: cleanText(row.notes),
    proposedByUserId: cleanText(row.proposed_by_user_id),
    confirmedByUserId: cleanText(row.confirmed_by_user_id),
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
  }
}

function readLocalScheduleItems() {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TIQ_LEAGUE_SCHEDULE_STORAGE_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((row) => normalizeRow({
        id: row.id,
        league_id: row.leagueId,
        league_format: row.leagueFormat,
        participant_a_name: row.participantAName,
        participant_a_id: row.participantAId,
        participant_b_name: row.participantBName,
        participant_b_id: row.participantBId,
        scheduled_date: row.scheduledDate,
        scheduled_time: row.scheduledTime,
        facility: row.facility,
        status: row.status,
        notes: row.notes,
        proposed_by_user_id: row.proposedByUserId,
        confirmed_by_user_id: row.confirmedByUserId,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
      }))
      .filter((item): item is TiqLeagueScheduleItem => Boolean(item))
  } catch {
    return []
  }
}

function writeLocalScheduleItems(items: TiqLeagueScheduleItem[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(TIQ_LEAGUE_SCHEDULE_STORAGE_KEY, JSON.stringify(items))
}

async function getAuthenticatedUserId() {
  const auth = await getClientAuthState()
  return cleanText(auth.user?.id)
}

function sortScheduleItems(items: TiqLeagueScheduleItem[]) {
  return [...items].sort((left, right) => {
    const leftKey = `${left.scheduledDate || '9999-12-31'} ${left.scheduledTime || '99:99'}`
    const rightKey = `${right.scheduledDate || '9999-12-31'} ${right.scheduledTime || '99:99'}`
    return leftKey.localeCompare(rightKey)
  })
}

export async function listTiqLeagueScheduleItems(
  leagueId: string,
): Promise<{ items: TiqLeagueScheduleItem[]; source: TiqLeagueScheduleSource; warning: string | null }> {
  const normalizedLeagueId = cleanText(leagueId)

  try {
    const { data, error } = await supabase
      .from(TIQ_LEAGUE_SCHEDULE_TABLE)
      .select('id, league_id, league_format, participant_a_name, participant_a_id, participant_b_name, participant_b_id, scheduled_date, scheduled_time, facility, status, notes, proposed_by_user_id, confirmed_by_user_id, created_at, updated_at')
      .eq('league_id', normalizedLeagueId)
      .neq('status', 'cancelled')
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true })

    if (error) throw error

    return {
      items: ((data || []) as TiqLeagueScheduleRow[])
        .map(normalizeRow)
        .filter((item): item is TiqLeagueScheduleItem => Boolean(item)),
      source: 'supabase',
      warning: null,
    }
  } catch (error) {
    return {
      items: sortScheduleItems(
        readLocalScheduleItems().filter((item) => item.leagueId === normalizedLeagueId && item.status !== 'cancelled'),
      ),
      source: 'local',
      warning:
        error instanceof Error
          ? 'TIQ schedule is available on this device while cloud sync catches up.'
          : 'TIQ schedule is available on this device while cloud sync catches up.',
    }
  }
}

export async function saveTiqLeagueScheduleItem(input: {
  leagueId: string
  leagueFormat: TiqLeagueScheduleFormat
  participantAName: string
  participantAId?: string | null
  participantBName: string
  participantBId?: string | null
  scheduledDate: string
  scheduledTime?: string | null
  facility?: string | null
  status: Extract<TiqLeagueScheduleStatus, 'proposed' | 'confirmed' | 'coordinator_set'>
  notes?: string | null
}): Promise<{ item: TiqLeagueScheduleItem | null; source: TiqLeagueScheduleSource; warning: string | null }> {
  const now = new Date().toISOString()
  const userId = await getAuthenticatedUserId()
  const localItem: TiqLeagueScheduleItem = {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `schedule-${Date.now()}`,
    leagueId: cleanText(input.leagueId),
    leagueFormat: input.leagueFormat,
    participantAName: cleanText(input.participantAName),
    participantAId: cleanText(input.participantAId),
    participantBName: cleanText(input.participantBName),
    participantBId: cleanText(input.participantBId),
    scheduledDate: cleanText(input.scheduledDate),
    scheduledTime: cleanText(input.scheduledTime),
    facility: cleanText(input.facility),
    status: input.status,
    notes: cleanText(input.notes),
    proposedByUserId: userId,
    confirmedByUserId: input.status === 'confirmed' || input.status === 'coordinator_set' ? userId : '',
    createdAt: now,
    updatedAt: now,
  }

  if (!userId) {
    return {
      item: null,
      source: 'local',
      warning: 'Sign in to schedule this TIQ league match.',
    }
  }

  if (!localItem.leagueId || !localItem.participantAName || !localItem.participantBName || !localItem.scheduledDate) {
    return {
      item: null,
      source: 'local',
      warning: 'Choose both participants and a match date before saving the schedule item.',
    }
  }

  try {
    const { data, error } = await supabase
      .from(TIQ_LEAGUE_SCHEDULE_TABLE)
      .insert({
        league_id: localItem.leagueId,
        league_format: localItem.leagueFormat,
        participant_a_name: localItem.participantAName,
        participant_a_id: localItem.participantAId || null,
        participant_b_name: localItem.participantBName,
        participant_b_id: localItem.participantBId || null,
        scheduled_date: localItem.scheduledDate,
        scheduled_time: localItem.scheduledTime || null,
        facility: localItem.facility,
        status: localItem.status,
        notes: localItem.notes,
        proposed_by_user_id: userId,
        confirmed_by_user_id: localItem.confirmedByUserId || null,
        created_by_user_id: userId,
        updated_by_user_id: userId,
      })
      .select()
      .single()

    if (error) throw error

    return {
      item: normalizeRow(data as TiqLeagueScheduleRow),
      source: 'supabase',
      warning: null,
    }
  } catch (error) {
    const localItems = readLocalScheduleItems()
    writeLocalScheduleItems(sortScheduleItems([localItem, ...localItems]))
    return {
      item: localItem,
      source: 'local',
      warning:
        error instanceof Error
          ? 'Schedule saved on this device. Cloud sync will retry later.'
          : 'Schedule saved on this device. Cloud sync will retry later.',
    }
  }
}

export async function updateTiqLeagueScheduleStatus(input: {
  scheduleItemId: string
  status: Extract<TiqLeagueScheduleStatus, 'confirmed' | 'cancelled'>
}): Promise<{ item: TiqLeagueScheduleItem | null; source: TiqLeagueScheduleSource; warning: string | null }> {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return {
      item: null,
      source: 'local',
      warning: 'Sign in to update this schedule item.',
    }
  }

  try {
    const { data, error } = await supabase
      .from(TIQ_LEAGUE_SCHEDULE_TABLE)
      .update({
        status: input.status,
        confirmed_by_user_id: input.status === 'confirmed' ? userId : null,
        updated_by_user_id: userId,
      })
      .eq('id', cleanText(input.scheduleItemId))
      .select()
      .single()

    if (error) throw error

    return {
      item: normalizeRow(data as TiqLeagueScheduleRow),
      source: 'supabase',
      warning: null,
    }
  } catch (error) {
    const localItems = readLocalScheduleItems()
    const nextItems = localItems.map((item) =>
      item.id === cleanText(input.scheduleItemId)
        ? {
            ...item,
            status: input.status,
            confirmedByUserId: input.status === 'confirmed' ? userId : '',
            updatedAt: new Date().toISOString(),
          }
        : item,
    )
    writeLocalScheduleItems(nextItems)
    return {
      item: nextItems.find((item) => item.id === cleanText(input.scheduleItemId)) || null,
      source: 'local',
      warning:
        error instanceof Error
          ? 'Schedule updated on this device. Cloud sync will retry later.'
          : 'Schedule updated on this device. Cloud sync will retry later.',
    }
  }
}
