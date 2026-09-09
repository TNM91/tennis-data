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
import { assignPracticeDisplayStatuses, normalizePracticeName, type PracticeDisplayStatus } from '@/lib/captain-practice-rsvp'
import { supabase } from '@/lib/supabase'
import {
  saveTiqLeagueScheduleItem,
  updateTiqLeagueScheduleItem,
  type TiqLeagueScheduleFormat,
  updateTiqLeagueScheduleStatus,
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
  profileName: string
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

type CaptainPracticeInviteRow = {
  id?: string | null
  public_token?: string | null
  capacity?: number | null
}

type CaptainPracticeInviteeRow = {
  id?: string | null
  player_name?: string | null
  response_status?: InternalScheduleResponseStatus | null
  responded_at?: string | null
}

export type CaptainPracticeRosterOverview = {
  publicToken: string
  capacity: number | null
  roster: Array<{
    id: string
    playerName: string
    responseStatus: InternalScheduleResponseStatus
    displayStatus: PracticeDisplayStatus
    respondedAt: string
  }>
}

type DirectoryRosterRow = {
  id?: string | null
  linked_player_id?: string | null
  display_name?: string | null
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

function toScheduleResponse(row: ScheduleResponseRow, profileName = ''): InternalScheduleResponse | null {
  const eventId = cleanText(row.event_id)
  const profileId = cleanText(row.profile_id)
  if (!eventId || !profileId) return null

  return {
    eventId,
    profileId,
    profileName: cleanText(profileName),
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

async function loadCaptainPracticeRoster(input: {
  teamName: string
  leagueName?: string | null
  flight?: string | null
}) {
  const rosterResult = await supabase
    .from('team_roster_members')
    .select('player_id, player_name, team_name, league_name, flight')
    .eq('normalized_team_name', normalizeTeamName(input.teamName))
    .limit(200)

  const rosterRows = rosterResult.error ? [] : ((rosterResult.data || []) as RosterRow[])
  return rosterRows.filter((row) => {
    if (input.leagueName && safeText(row.league_name, '') && safeText(row.league_name) !== input.leagueName) return false
    if (input.flight && safeText(row.flight, '') && safeText(row.flight) !== input.flight) return false
    return true
  })
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
  capacity?: number | null
}) {
  const identity = await getInternalIdentity()
  if (!identity) throw new Error('Sign in to schedule practice through Messages.')

  const filteredRows = await loadCaptainPracticeRoster(input)
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
    input.capacity ? `Spots: ${input.capacity}` : '',
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
      capacity: input.capacity ? String(input.capacity) : '',
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
      practiceNotes: input.notes || '',
      capacity: input.capacity ? String(input.capacity) : '',
    },
    participantProfileIds,
  })

  const invite = await createCaptainPracticeInvite({
    eventId: event.id,
    identity,
    roster: filteredRows,
    teamName: input.teamName,
    leagueName: input.leagueName,
    flight: input.flight,
    capacity: input.capacity,
  })

  const eventWithInvite = {
    ...event,
    metadata: {
      ...event.metadata,
      publicToken: invite.publicToken,
    },
  }
  await supabase
    .from('internal_schedule_events')
    .update({ metadata: eventWithInvite.metadata })
    .eq('id', event.id)

  return {
    conversationId,
    event: eventWithInvite,
    publicToken: invite.publicToken,
    rosterCount: filteredRows.length,
    linkedParticipantCount: participantProfileIds.length,
  }
}

async function createCaptainPracticeInvite(input: {
  eventId: string
  identity: InternalIdentity
  roster: RosterRow[]
  teamName: string
  leagueName?: string | null
  flight?: string | null
  capacity?: number | null
}) {
  const capacity = input.capacity && input.capacity > 0 ? Math.min(100, Math.round(input.capacity)) : null
  const { data, error } = await supabase
    .from('captain_practice_invites')
    .insert({
      event_id: input.eventId,
      capacity,
      created_by_user_id: input.identity.userId,
    })
    .select('id,public_token,capacity')
    .single()
  if (error) throw new Error(`Practice RSVP link could not be created: ${error.message}`)
  const invite = data as CaptainPracticeInviteRow
  const inviteId = cleanText(invite.id)
  const publicToken = cleanText(invite.public_token)
  if (!inviteId || !publicToken) throw new Error('Practice RSVP link could not be created.')

  const playerIds = Array.from(new Set(input.roster.map((row) => cleanText(row.player_id)).filter(Boolean)))
  const profileByPlayerId = new Map<string, string>()
  if (playerIds.length) {
    const directoryResult = await supabase
      .from('internal_message_directory')
      .select('id,linked_player_id')
      .in('linked_player_id', playerIds)
    for (const row of (directoryResult.data ?? []) as DirectoryRosterRow[]) {
      const playerId = cleanText(row.linked_player_id)
      const profileId = cleanText(row.id)
      if (playerId && profileId) profileByPlayerId.set(playerId, profileId)
    }
  }

  const contactResult = await supabase
    .from('captain_roster_contacts')
    .select('full_name,normalized_name,phone,league_name,flight')
    .eq('captain_user_id', input.identity.userId)
    .eq('normalized_team_name', normalizeTeamName(input.teamName))
    .limit(250)
  const scopedContacts = ((contactResult.data ?? []) as Array<{
    full_name?: string | null
    normalized_name?: string | null
    phone?: string | null
    league_name?: string | null
    flight?: string | null
  }>).filter((contact) => {
    if (input.leagueName && cleanText(contact.league_name) && cleanText(contact.league_name) !== input.leagueName) return false
    if (input.flight && cleanText(contact.flight) && cleanText(contact.flight) !== input.flight) return false
    return true
  })
  const phoneByName = new Map(scopedContacts.map((contact) => [
    normalizePracticeName(contact.normalized_name || contact.full_name),
    cleanText(contact.phone),
  ]))
  const inviteesByName = new Map(input.roster
    .map((row) => {
      const playerName = cleanText(row.player_name)
      const normalizedName = normalizePracticeName(playerName)
      const playerId = cleanText(row.player_id)
      const profileId = profileByPlayerId.get(playerId) || null
      return [normalizedName, {
        invite_id: inviteId,
        event_id: input.eventId,
        player_id: playerId,
        profile_id: profileId,
        player_name: playerName,
        normalized_name: normalizedName,
        phone: phoneByName.get(normalizedName) || '',
        response_status: profileId === input.identity.userId ? 'in' : 'unanswered',
        responded_at: profileId === input.identity.userId ? new Date().toISOString() : null,
      }] as const
    })
    .filter(([normalizedName, row]) => Boolean(normalizedName && row.player_name)))
  const invitees = Array.from(inviteesByName.values())
  if (invitees.length) {
    const inviteeResult = await supabase.from('captain_practice_invitees').insert(invitees)
    if (inviteeResult.error) throw new Error(`Practice roster could not be opened: ${inviteeResult.error.message}`)
  }
  return { id: inviteId, publicToken, capacity }
}

export async function listCaptainPracticeRoster(eventId: string): Promise<CaptainPracticeRosterOverview | null> {
  const { data, error } = await supabase
    .from('captain_practice_invites')
    .select('id,public_token,capacity')
    .eq('event_id', eventId)
    .maybeSingle()
  if (error || !data) return null
  const invite = data as CaptainPracticeInviteRow
  const { data: rows, error: rosterError } = await supabase
    .from('captain_practice_invitees')
    .select('id,player_name,response_status,responded_at')
    .eq('invite_id', cleanText(invite.id))
    .order('player_name', { ascending: true })
  if (rosterError) return null
  const roster = assignPracticeDisplayStatuses(
    ((rows ?? []) as CaptainPracticeInviteeRow[]).map((row) => ({
      id: cleanText(row.id),
      playerName: cleanText(row.player_name),
      responseStatus: normalizeResponseStatus(row.response_status),
      respondedAt: cleanText(row.responded_at),
    })),
    typeof invite.capacity === 'number' ? invite.capacity : null,
  )
  return {
    publicToken: cleanText(invite.public_token),
    capacity: typeof invite.capacity === 'number' ? invite.capacity : null,
    roster,
  }
}

export async function previewCaptainPracticeRecipients(input: {
  teamName: string
  leagueName?: string | null
  flight?: string | null
}) {
  if (!input.teamName.trim()) {
    return {
      rosterCount: 0,
      linkedParticipantCount: 0,
      linkedRecipientNames: [] as string[],
      unlinkedRosterNames: [] as string[],
    }
  }

  const filteredRows = await loadCaptainPracticeRoster(input)
  const playerIds = Array.from(new Set(filteredRows.map((row) => cleanText(row.player_id)).filter(Boolean)))
  const linkedByPlayerId = new Map<string, DirectoryRosterRow>()

  if (playerIds.length) {
    const { data } = await supabase
      .from('internal_message_directory')
      .select('id, linked_player_id, display_name')
      .in('linked_player_id', playerIds)

    for (const row of (data || []) as DirectoryRosterRow[]) {
      const playerId = cleanText(row.linked_player_id)
      if (playerId && !linkedByPlayerId.has(playerId)) linkedByPlayerId.set(playerId, row)
    }
  }

  const linkedRecipientNames = Array.from(
    new Set(Array.from(linkedByPlayerId.values()).map((row) => cleanText(row.display_name)).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b))
  const unlinkedRosterNames = filteredRows
    .filter((row) => !linkedByPlayerId.has(cleanText(row.player_id)))
    .map((row) => cleanText(row.player_name))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))

  return {
    rosterCount: filteredRows.length,
    linkedParticipantCount: linkedRecipientNames.length,
    linkedRecipientNames,
    unlinkedRosterNames,
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
  const rows = (data || []) as ScheduleResponseRow[]
  const profileIds = Array.from(new Set(rows.map((row) => cleanText(row.profile_id)).filter(Boolean)))
  const profileNameById = new Map<string, string>()
  if (profileIds.length) {
    const directoryResult = await supabase
      .from('internal_message_directory')
      .select('id, display_name')
      .in('id', profileIds)
    for (const profile of (directoryResult.data || []) as DirectoryRosterRow[]) {
      const profileId = cleanText(profile.id)
      if (profileId) profileNameById.set(profileId, cleanText(profile.display_name))
    }
  }
  return rows
    .map((row) => toScheduleResponse(row, profileNameById.get(cleanText(row.profile_id)) || ''))
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

  await supabase
    .from('captain_practice_invitees')
    .update({
      response_status: input.responseStatus,
      note: input.note || '',
      responded_at: new Date().toISOString(),
    })
    .eq('profile_id', input.profileId)
    .eq('event_id', input.eventId)

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

export async function updateInternalScheduleEvent(input: {
  eventId: string
  actorUserId: string
  scheduledDate: string
  scheduledTime?: string | null
  facility?: string | null
  notes?: string | null
}) {
  const eventId = cleanText(input.eventId)
  const scheduledDate = cleanText(input.scheduledDate)
  if (!eventId) throw new Error('Choose a schedule event first.')
  if (!scheduledDate) throw new Error('Choose a schedule date first.')

  const existingEvents = await listInternalScheduleEventsByIds([eventId])
  const existingEvent = existingEvents[0]
  if (!existingEvent) throw new Error('Schedule event was not found.')

  const metadata = {
    ...existingEvent.metadata,
    scheduleDate: scheduledDate,
    scheduleTime: cleanText(input.scheduledTime),
    facility: cleanText(input.facility),
  }

  if (existingEvent.sourceEntityType === 'tiq_schedule_item' && existingEvent.sourceEntityId) {
    await updateTiqLeagueScheduleItem({
      scheduleItemId: existingEvent.sourceEntityId,
      scheduledDate,
      scheduledTime: input.scheduledTime,
      facility: input.facility,
      notes: input.notes,
    })
  }

  const { data, error } = await supabase
    .from('internal_schedule_events')
    .update({
      scheduled_date: scheduledDate,
      scheduled_time: cleanText(input.scheduledTime),
      facility: cleanText(input.facility),
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .select('id, conversation_id, event_type, title, scheduled_date, scheduled_time, facility, recurrence_rule, status, source_entity_type, source_entity_id, metadata, created_by_user_id, created_at, updated_at')
    .single()

  if (error) throw new Error(error.message)
  const updatedEvent = toScheduleEvent(data as ScheduleEventRow)
  if (!updatedEvent) throw new Error('Schedule event could not be updated.')

  await sendInternalMessage(
    updatedEvent.conversationId,
    input.actorUserId,
    [
      `Schedule updated: ${updatedEvent.title}`,
      `Date: ${updatedEvent.scheduledDate}`,
      updatedEvent.scheduledTime ? `Time: ${updatedEvent.scheduledTime}` : '',
      updatedEvent.facility ? `Site: ${updatedEvent.facility}` : '',
      cleanText(input.notes) ? `Notes: ${cleanText(input.notes)}` : '',
    ].filter(Boolean).join('\n'),
    {
      notificationType: 'schedule',
      notificationTitle: 'Schedule updated',
      notificationBody: 'Open Messages to review the updated time or site.',
      scheduleEventId: updatedEvent.id,
    },
  )

  return updatedEvent
}

export async function cancelInternalScheduleEvent(input: {
  eventId: string
  actorUserId: string
  reason?: string | null
}) {
  const eventId = cleanText(input.eventId)
  if (!eventId) throw new Error('Choose a schedule event first.')

  const existingEvents = await listInternalScheduleEventsByIds([eventId])
  const existingEvent = existingEvents[0]
  if (!existingEvent) throw new Error('Schedule event was not found.')

  if (existingEvent.sourceEntityType === 'tiq_schedule_item' && existingEvent.sourceEntityId) {
    await updateTiqLeagueScheduleStatus({
      scheduleItemId: existingEvent.sourceEntityId,
      status: 'cancelled',
    })
  }

  const { data, error } = await supabase
    .from('internal_schedule_events')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .select('id, conversation_id, event_type, title, scheduled_date, scheduled_time, facility, recurrence_rule, status, source_entity_type, source_entity_id, metadata, created_by_user_id, created_at, updated_at')
    .single()

  if (error) throw new Error(error.message)
  const cancelledEvent = toScheduleEvent(data as ScheduleEventRow)
  if (!cancelledEvent) throw new Error('Schedule event could not be cancelled.')

  await sendInternalMessage(
    cancelledEvent.conversationId,
    input.actorUserId,
    [
      `Schedule cancelled: ${cancelledEvent.title}`,
      cleanText(input.reason) ? `Reason: ${cleanText(input.reason)}` : '',
    ].filter(Boolean).join('\n'),
    {
      notificationType: 'schedule',
      notificationTitle: 'Schedule cancelled',
      notificationBody: 'Open Messages to review the cancelled event.',
      scheduleEventId: cancelledEvent.id,
    },
  )

  return cancelledEvent
}

async function listInternalScheduleEventsByIds(eventIds: string[]) {
  const ids = Array.from(new Set(eventIds.map(cleanText).filter(Boolean)))
  if (!ids.length) return []

  const { data, error } = await supabase
    .from('internal_schedule_events')
    .select('id, conversation_id, event_type, title, scheduled_date, scheduled_time, facility, recurrence_rule, status, source_entity_type, source_entity_id, metadata, created_by_user_id, created_at, updated_at')
    .in('id', ids)

  if (error) throw new Error(error.message)
  return ((data || []) as ScheduleEventRow[])
    .map(toScheduleEvent)
    .filter((event): event is InternalScheduleEvent => Boolean(event))
}
