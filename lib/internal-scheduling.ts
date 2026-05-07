'use client'

import {
  createLeagueConversation,
  findInternalRecipient,
  findInternalRecipientByPlayerId,
  getInternalIdentity,
  sendInternalMessage,
  type InternalIdentity,
} from '@/lib/internal-messages'
import { safeText, normalizeTeamName } from '@/lib/captain-formatters'
import { supabase } from '@/lib/supabase'
import {
  saveTiqLeagueScheduleItem,
  type TiqLeagueScheduleFormat,
} from '@/lib/tiq-league-schedule-service'

export type InternalScheduleEventType = 'tiq_league_match' | 'captain_practice'
export type InternalScheduleEventStatus = 'proposed' | 'confirmed' | 'cancelled' | 'completed'
export type InternalScheduleResponseStatus = 'in' | 'out' | 'maybe' | 'unanswered'

export type InternalScheduleEvent = {
  id: string
  conversationId: string
  eventType: InternalScheduleEventType
  title: string
  scheduledDate: string
  scheduledTime: string
  facility: string
  recurrenceRule: string
  status: InternalScheduleEventStatus
  sourceEntityType: string
  sourceEntityId: string
  metadata: Record<string, string>
  createdByUserId: string
  createdAt: string
  updatedAt: string
}

export type InternalScheduleResponse = {
  eventId: string
  profileId: string
  responseStatus: InternalScheduleResponseStatus
  note: string
  updatedAt: string
}

type ScheduleEventRow = {
  id?: string | null
  conversation_id?: string | null
  event_type?: string | null
  title?: string | null
  scheduled_date?: string | null
  scheduled_time?: string | null
  facility?: string | null
  recurrence_rule?: string | null
  status?: string | null
  source_entity_type?: string | null
  source_entity_id?: string | null
  metadata?: Record<string, string> | null
  created_by_user_id?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type ScheduleResponseRow = {
  event_id?: string | null
  profile_id?: string | null
  response_status?: string | null
  note?: string | null
  updated_at?: string | null
}

type RosterRow = {
  player_id?: string | null
  player_name?: string | null
  team_name?: string | null
  league_name?: string | null
  flight?: string | null
}

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
}

function normalizeEventType(value: string | null | undefined): InternalScheduleEventType {
  return value === 'tiq_league_match' ? 'tiq_league_match' : 'captain_practice'
}

function normalizeEventStatus(value: string | null | undefined): InternalScheduleEventStatus {
  if (value === 'confirmed' || value === 'cancelled' || value === 'completed') return value
  return 'proposed'
}

function normalizeResponseStatus(value: string | null | undefined): InternalScheduleResponseStatus {
  if (value === 'in' || value === 'out' || value === 'maybe') return value
  return 'unanswered'
}

function normalizeMetadata(value: Record<string, string> | null | undefined): Record<string, string> {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => typeof item === 'string' && item.trim())
      .map(([key, item]) => [key, item.trim()]),
  )
}

function toScheduleEvent(row: ScheduleEventRow): InternalScheduleEvent | null {
  const id = cleanText(row.id)
  const conversationId = cleanText(row.conversation_id)
  if (!id || !conversationId) return null

  return {
    id,
    conversationId,
    eventType: normalizeEventType(row.event_type),
    title: cleanText(row.title),
    scheduledDate: cleanText(row.scheduled_date),
    scheduledTime: cleanText(row.scheduled_time),
    facility: cleanText(row.facility),
    recurrenceRule: cleanText(row.recurrence_rule),
    status: normalizeEventStatus(row.status),
    sourceEntityType: cleanText(row.source_entity_type),
    sourceEntityId: cleanText(row.source_entity_id),
    metadata: normalizeMetadata(row.metadata),
    createdByUserId: cleanText(row.created_by_user_id),
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
  }
}

function toScheduleResponse(row: ScheduleResponseRow): InternalScheduleResponse | null {
  const eventId = cleanText(row.event_id)
  const profileId = cleanText(row.profile_id)
  if (!eventId || !profileId) return null

  return {
    eventId,
    profileId,
    responseStatus: normalizeResponseStatus(row.response_status),
    note: cleanText(row.note),
    updatedAt: cleanText(row.updated_at),
  }
}

async function resolveProfileIds(input: {
  playerIds?: string[]
  names?: string[]
  profileIds?: string[]
}) {
  const profileIds = new Set<string>()

  for (const profileId of input.profileIds || []) {
    if (cleanText(profileId)) profileIds.add(cleanText(profileId))
  }

  for (const playerId of input.playerIds || []) {
    const recipient = await findInternalRecipientByPlayerId(playerId)
    if (recipient) profileIds.add(recipient.id)
  }

  for (const name of input.names || []) {
    const recipient = await findInternalRecipient(name)
    if (recipient) profileIds.add(recipient.id)
  }

  return Array.from(profileIds)
}

async function createInternalScheduleEvent(input: {
  identity: InternalIdentity
  conversationId: string
  eventType: InternalScheduleEventType
  title: string
  scheduledDate: string
  scheduledTime?: string
  facility?: string
  recurrenceRule?: string
  status?: InternalScheduleEventStatus
  sourceEntityType?: string
  sourceEntityId?: string
  metadata?: Record<string, string>
  participantProfileIds?: string[]
}) {
  const { data, error } = await supabase
    .from('internal_schedule_events')
    .insert({
      conversation_id: input.conversationId,
      event_type: input.eventType,
      title: input.title,
      scheduled_date: input.scheduledDate,
      scheduled_time: input.scheduledTime || '',
      facility: input.facility || '',
      recurrence_rule: input.recurrenceRule || '',
      status: input.status || 'proposed',
      source_entity_type: input.sourceEntityType || '',
      source_entity_id: input.sourceEntityId || '',
      metadata: input.metadata || {},
      created_by_user_id: input.identity.userId,
    })
    .select('id, conversation_id, event_type, title, scheduled_date, scheduled_time, facility, recurrence_rule, status, source_entity_type, source_entity_id, metadata, created_by_user_id, created_at, updated_at')
    .single()

  if (error) throw new Error(error.message)
  const event = toScheduleEvent(data as ScheduleEventRow)
  if (!event) throw new Error('Schedule event could not be created.')

  const responseProfileIds = Array.from(new Set([input.identity.userId, ...(input.participantProfileIds || [])]))
  if (responseProfileIds.length) {
    const responseResult = await supabase.from('internal_schedule_event_responses').upsert(
      responseProfileIds.map((profileId) => ({
        event_id: event.id,
        profile_id: profileId,
        response_status: profileId === input.identity.userId ? 'in' : 'unanswered',
      })),
      { onConflict: 'event_id,profile_id' },
    )
    if (responseResult.error) throw new Error(responseResult.error.message)
  }

  return event
}

export async function createTiqLeagueScheduleThread(input: {
  leagueId: string
  leagueName: string
  leagueFormat: TiqLeagueScheduleFormat
  participantAName: string
  participantAId?: string | null
  participantBName: string
  participantBId?: string | null
  scheduledDate: string
  scheduledTime?: string | null
  facility?: string | null
  notes?: string | null
  participantNames?: string[]
  participantPlayerIds?: string[]
}) {
  const identity = await getInternalIdentity()
  if (!identity) throw new Error('Sign in to schedule through Messages.')

  const scheduleResult = await saveTiqLeagueScheduleItem({
    leagueId: input.leagueId,
    leagueFormat: input.leagueFormat,
    participantAName: input.participantAName,
    participantAId: input.participantAId,
    participantBName: input.participantBName,
    participantBId: input.participantBId,
    scheduledDate: input.scheduledDate,
    scheduledTime: input.scheduledTime,
    facility: input.facility,
    notes: input.notes,
    status: 'proposed',
  })

  if (!scheduleResult.item) {
    throw new Error(scheduleResult.warning || 'League schedule item could not be created.')
  }

  const participantProfileIds = await resolveProfileIds({
    playerIds: [
      input.participantAId || '',
      input.participantBId || '',
      ...(input.participantPlayerIds || []),
    ].filter(Boolean),
    names: [
      input.participantAName,
      input.participantBName,
      ...(input.participantNames || []),
    ].filter(Boolean),
  })
  const subject = `${input.participantAName} vs ${input.participantBName}`
  const details = [
    `League: ${input.leagueName}`,
    `Match: ${input.participantAName} vs ${input.participantBName}`,
    `Date: ${input.scheduledDate}`,
    input.scheduledTime ? `Time: ${input.scheduledTime}` : '',
    input.facility ? `Site: ${input.facility}` : '',
    input.notes ? `Notes: ${input.notes}` : '',
    '',
    'Please reply In, Out, or Maybe for this scheduled match.',
  ].filter(Boolean).join('\n')

  const conversationId = await createLeagueConversation(identity, {
    leagueId: input.leagueId,
    leagueName: input.leagueName,
    subject,
    body: details,
    participantProfileIds,
    entityType: 'tiq_schedule_item',
    entityId: scheduleResult.item.id,
    metadata: {
      scheduleItemId: scheduleResult.item.id,
      scheduleDate: input.scheduledDate,
      scheduleTime: input.scheduledTime || '',
      facility: input.facility || '',
    },
  })

  const event = await createInternalScheduleEvent({
    identity,
    conversationId,
    eventType: 'tiq_league_match',
    title: subject,
    scheduledDate: input.scheduledDate,
    scheduledTime: input.scheduledTime || '',
    facility: input.facility || '',
    sourceEntityType: 'tiq_schedule_item',
    sourceEntityId: scheduleResult.item.id,
    metadata: {
      leagueId: input.leagueId,
      leagueName: input.leagueName,
      scheduleItemId: scheduleResult.item.id,
    },
    participantProfileIds,
  })

  return {
    conversationId,
    scheduleItem: scheduleResult.item,
    event,
    warning: scheduleResult.warning,
  }
}

export async function createCaptainPracticeThread(input: {
  teamName: string
  leagueName?: string | null
  flight?: string | null
  scheduledDate: string
  scheduledTime?: string | null
  facility?: string | null
  recurrenceRule?: string | null
  notes?: string | null
}) {
  const identity = await getInternalIdentity()
  if (!identity) throw new Error('Sign in to schedule practice through Messages.')

  const rosterResult = await supabase
    .from('team_roster_members')
    .select('player_id, player_name, team_name, league_name, flight')
    .eq('normalized_team_name', normalizeTeamName(input.teamName))
    .limit(200)

  const rosterRows = rosterResult.error ? [] : ((rosterResult.data || []) as RosterRow[])
  const filteredRows = rosterRows.filter((row) => {
    if (input.leagueName && safeText(row.league_name, '') && safeText(row.league_name) !== input.leagueName) return false
    if (input.flight && safeText(row.flight, '') && safeText(row.flight) !== input.flight) return false
    return true
  })
  const playerIds = filteredRows.map((row) => cleanText(row.player_id)).filter(Boolean)
  const names = filteredRows.map((row) => cleanText(row.player_name)).filter(Boolean)
  const participantProfileIds = await resolveProfileIds({ playerIds, names })
  const title = `${input.teamName} practice`
  const body = [
    `Practice: ${input.teamName}`,
    input.leagueName ? `League: ${input.leagueName}` : '',
    input.flight ? `Flight: ${input.flight}` : '',
    `Date: ${input.scheduledDate}`,
    input.scheduledTime ? `Time: ${input.scheduledTime}` : '',
    input.facility ? `Site: ${input.facility}` : '',
    input.recurrenceRule ? `Repeats: ${input.recurrenceRule}` : '',
    input.notes ? `Notes: ${input.notes}` : '',
    '',
    'Please mark In, Out, or Maybe so the captain knows who can make it.',
  ].filter(Boolean).join('\n')

  const conversationId = await createLeagueConversation(identity, {
    leagueId: input.teamName,
    leagueName: input.teamName,
    subject: title,
    body,
    participantProfileIds,
    participantPlayerIds: playerIds,
    participantNames: names,
    entityType: 'captain_practice',
    entityId: `${normalizeTeamName(input.teamName)}-${input.scheduledDate}`,
    metadata: {
      teamName: input.teamName,
      leagueName: input.leagueName || '',
      flight: input.flight || '',
      scheduleDate: input.scheduledDate,
      scheduleTime: input.scheduledTime || '',
      facility: input.facility || '',
      recurrenceRule: input.recurrenceRule || '',
    },
  })

  const event = await createInternalScheduleEvent({
    identity,
    conversationId,
    eventType: 'captain_practice',
    title,
    scheduledDate: input.scheduledDate,
    scheduledTime: input.scheduledTime || '',
    facility: input.facility || '',
    recurrenceRule: input.recurrenceRule || '',
    sourceEntityType: 'captain_practice',
    sourceEntityId: `${normalizeTeamName(input.teamName)}-${input.scheduledDate}`,
    metadata: {
      teamName: input.teamName,
      leagueName: input.leagueName || '',
      flight: input.flight || '',
    },
    participantProfileIds,
  })

  return {
    conversationId,
    event,
    rosterCount: filteredRows.length,
    linkedParticipantCount: participantProfileIds.length,
  }
}

export async function listInternalScheduleEventsForConversation(conversationId: string) {
  const { data, error } = await supabase
    .from('internal_schedule_events')
    .select('id, conversation_id, event_type, title, scheduled_date, scheduled_time, facility, recurrence_rule, status, source_entity_type, source_entity_id, metadata, created_by_user_id, created_at, updated_at')
    .eq('conversation_id', conversationId)
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data || []) as ScheduleEventRow[])
    .map(toScheduleEvent)
    .filter((event): event is InternalScheduleEvent => Boolean(event))
}

export async function listInternalScheduleResponses(eventIds: string[]) {
  if (!eventIds.length) return []

  const { data, error } = await supabase
    .from('internal_schedule_event_responses')
    .select('event_id, profile_id, response_status, note, updated_at')
    .in('event_id', eventIds)

  if (error) throw new Error(error.message)
  return ((data || []) as ScheduleResponseRow[])
    .map(toScheduleResponse)
    .filter((response): response is InternalScheduleResponse => Boolean(response))
}

export async function saveInternalScheduleResponse(input: {
  eventId: string
  profileId: string
  responseStatus: InternalScheduleResponseStatus
  note?: string | null
  conversationId?: string | null
}) {
  const { error } = await supabase
    .from('internal_schedule_event_responses')
    .upsert({
      event_id: input.eventId,
      profile_id: input.profileId,
      response_status: input.responseStatus,
      note: input.note || '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'event_id,profile_id' })

  if (error) throw new Error(error.message)

  if (input.conversationId) {
    const label = input.responseStatus === 'in' ? 'In' : input.responseStatus === 'out' ? 'Out' : input.responseStatus === 'maybe' ? 'Maybe' : 'Unanswered'
    await sendInternalMessage(
      input.conversationId,
      input.profileId,
      `RSVP: ${label}${input.note ? ` - ${input.note}` : ''}`,
      {
        notificationType: 'schedule',
        notificationTitle: 'Schedule RSVP updated',
        notificationBody: `${label} for the scheduled event.`,
        scheduleEventId: input.eventId,
      },
    )
  }
}
