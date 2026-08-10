import { getSignedInPlayerApiAuth } from '@/lib/player-api-auth'
import {
  COMPETITION_REMINDER_COOLDOWN_HOURS,
  splitCompetitionReminderTargetsByCooldown,
  type CompetitionReminderHistoryRow,
} from '../../../lib/competition-schedule-reminder-cooldown'

export const runtime = 'nodejs'

type ReminderBody = {
  competitionKind?: unknown
  competitionId?: unknown
  eventId?: unknown
  expectedPlayerNames?: unknown
}

type OwnerRow = {
  created_by_user_id?: string | null
  league_name?: string | null
  name?: string | null
  entrants?: string[] | null
  schedule?: Record<string, { date?: string | null; time?: string | null; court?: string | null }> | null
  location_label?: string | null
}

type LeagueScheduleRow = {
  participant_a_name?: string | null
  participant_b_name?: string | null
  scheduled_date?: string | null
  scheduled_time?: string | null
  facility?: string | null
  status?: string | null
}

type EntryRow = {
  player_name?: string | null
  created_by_user_id?: string | null
  submitted_by_user_id?: string | null
}

type ResponseRow = {
  player_user_id?: string | null
  response?: string | null
  event_snapshot?: Record<string, unknown> | null
}

type ReminderRow = {
  event_id?: string | null
  player_user_id?: string | null
  event_snapshot?: Record<string, unknown> | null
  sent_at?: string | null
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function normalizeName(value: unknown) {
  return cleanText(value).toLocaleLowerCase()
}

function uniqueNames(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(cleanText).filter(Boolean))).slice(0, 8)
}

function sameSnapshot(snapshot: Record<string, unknown> | null | undefined, current: {
  date: string
  time: string
  location: string
}) {
  return cleanText(snapshot?.date) === current.date
    && cleanText(snapshot?.time) === current.time
    && cleanText(snapshot?.location) === current.location
}

export async function POST(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  let body: ReminderBody
  try {
    body = (await request.json()) as ReminderBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid reminder request.' }, { status: 400 })
  }

  const competitionKind = body.competitionKind === 'league' || body.competitionKind === 'tournament'
    ? body.competitionKind
    : ''
  const competitionId = cleanText(body.competitionId)
  const eventId = cleanText(body.eventId)
  const requestedNames = uniqueNames(body.expectedPlayerNames)
  if (!competitionKind || !competitionId || !eventId || !requestedNames.length) {
    return Response.json({ ok: false, message: 'Choose a scheduled match before sending reminders.' }, { status: 400 })
  }
  if (!eventId.startsWith(`${competitionKind}:${competitionId}:`)) {
    return Response.json({ ok: false, message: 'This reminder does not match the selected competition.' }, { status: 400 })
  }

  const competitionTable = competitionKind === 'league' ? 'tiq_leagues' : 'tiq_tournaments'
  const competitionSelect = competitionKind === 'league'
    ? 'created_by_user_id,league_name'
    : 'created_by_user_id,name,entrants,schedule,location_label'
  const { data: ownerData, error: ownerError } = await auth.supabase
    .from(competitionTable)
    .select(competitionSelect)
    .eq('id', competitionId)
    .maybeSingle()
  const owner = ownerData as OwnerRow | null
  if (ownerError || cleanText(owner?.created_by_user_id) !== auth.userId) {
    return Response.json({ ok: false, message: 'Only this competition’s organizer can send reminders.' }, { status: 403 })
  }

  const eventRecordId = eventId.slice(`${competitionKind}:${competitionId}:`.length)
  let expectedNames: string[] = []
  let currentSnapshot = { date: '', time: '', location: '' }
  const competitionName = cleanText(owner?.league_name) || cleanText(owner?.name) || 'TIQ competition'

  if (competitionKind === 'league') {
    const { data, error } = await auth.supabase
      .from('tiq_league_schedule_items')
      .select('participant_a_name,participant_b_name,scheduled_date,scheduled_time,facility,status')
      .eq('id', eventRecordId)
      .eq('league_id', competitionId)
      .maybeSingle()
    const item = data as LeagueScheduleRow | null
    if (error || !item || !['confirmed', 'coordinator_set'].includes(cleanText(item.status))) {
      return Response.json({ ok: false, message: 'Publish or confirm this match before sending reminders.' }, { status: 409 })
    }
    expectedNames = [cleanText(item.participant_a_name), cleanText(item.participant_b_name)].filter(Boolean)
    currentSnapshot = {
      date: cleanText(item.scheduled_date),
      time: cleanText(item.scheduled_time),
      location: cleanText(item.facility),
    }
  } else {
    const schedule = owner?.schedule?.[eventRecordId]
    if (!schedule || !cleanText(schedule.date)) {
      return Response.json({ ok: false, message: 'Save this match slot before sending reminders.' }, { status: 409 })
    }
    const entrantNames = new Set((owner?.entrants ?? []).map(normalizeName).filter(Boolean))
    expectedNames = requestedNames.filter((name) => entrantNames.has(normalizeName(name)))
    const court = cleanText(schedule.court)
    currentSnapshot = {
      date: cleanText(schedule.date),
      time: cleanText(schedule.time),
      location: [cleanText(owner?.location_label), court ? `Court ${court}` : ''].filter(Boolean).join(' · '),
    }
  }

  const requestedNameSet = new Set(requestedNames.map(normalizeName))
  expectedNames = expectedNames.filter((name) => requestedNameSet.has(normalizeName(name)))
  if (!expectedNames.length || !currentSnapshot.date) {
    return Response.json({ ok: false, message: 'No players are waiting on this scheduled match.' }, { status: 409 })
  }

  const entryTable = competitionKind === 'league' ? 'tiq_player_league_entries' : 'tiq_tournament_entries'
  const competitionColumn = competitionKind === 'league' ? 'league_id' : 'tournament_id'
  const userColumn = competitionKind === 'league' ? 'created_by_user_id' : 'submitted_by_user_id'
  const statusColumn = competitionKind === 'league' ? 'entry_status' : 'status'
  const activeStatus = competitionKind === 'league' ? 'active' : 'approved'
  const { data: entryData, error: entryError } = await auth.supabase
    .from(entryTable)
    .select(`player_name,${userColumn}`)
    .eq(competitionColumn, competitionId)
    .eq(statusColumn, activeStatus)
  if (entryError) {
    return Response.json({ ok: false, message: 'Player entries could not be loaded.' }, { status: 500 })
  }

  const expectedNameSet = new Set(expectedNames.map(normalizeName))
  const targets = ((entryData ?? []) as EntryRow[]).flatMap((entry) => {
    const playerName = cleanText(entry.player_name)
    const playerUserId = cleanText(entry[userColumn as keyof EntryRow])
    if (!playerUserId || playerUserId === auth.userId || !expectedNameSet.has(normalizeName(playerName))) return []
    return [{ playerName, playerUserId }]
  })
  if (!targets.length) {
    return Response.json({ ok: true, sentCount: 0, message: 'No linked players need a reminder.' })
  }

  const { data: responseData, error: responseError } = await auth.supabase
    .from('player_schedule_responses')
    .select('player_user_id,response,event_snapshot')
    .eq('competition_kind', competitionKind)
    .eq('competition_id', competitionId)
    .eq('event_id', eventId)
  if (responseError) {
    return Response.json({ ok: false, message: 'Player replies could not be checked.' }, { status: 500 })
  }

  const responseByUserId = new Map(
    ((responseData ?? []) as ResponseRow[]).map((row) => [cleanText(row.player_user_id), row]),
  )
  const pendingReminderTargets = targets.filter((target) => {
    const response = responseByUserId.get(target.playerUserId)
    return !response || !sameSnapshot(response.event_snapshot, currentSnapshot)
  })
  if (!pendingReminderTargets.length) {
    return Response.json({ ok: true, sentCount: 0, message: 'Everyone has replied to the current match time.' })
  }

  const { data: reminderData, error: reminderError } = await auth.supabase
    .from('competition_schedule_reminders')
    .select('event_id,player_user_id,event_snapshot,sent_at')
    .eq('organizer_user_id', auth.userId)
    .eq('competition_kind', competitionKind)
    .eq('competition_id', competitionId)
    .eq('event_id', eventId)
    .in('player_user_id', pendingReminderTargets.map((target) => target.playerUserId))
  if (reminderError) {
    return Response.json({ ok: false, message: 'Reminder history could not be checked.' }, { status: 500 })
  }

  const reminderHistory = ((reminderData ?? []) as ReminderRow[]).flatMap((row): CompetitionReminderHistoryRow[] => {
    const historyEventId = cleanText(row.event_id)
    const playerUserId = cleanText(row.player_user_id)
    const sentAt = cleanText(row.sent_at)
    if (!historyEventId || !playerUserId || !sentAt) return []
    const snapshot = row.event_snapshot ?? {}
    return [{
      eventId: historyEventId,
      playerUserId,
      eventSnapshot: {
        date: cleanText(snapshot.date),
        time: cleanText(snapshot.time),
        location: cleanText(snapshot.location),
      },
      sentAt,
    }]
  })
  const cooldown = splitCompetitionReminderTargetsByCooldown({
    eventId,
    targets: pendingReminderTargets,
    history: reminderHistory,
    currentSnapshot,
  })
  if (!cooldown.eligible.length) {
    return Response.json({
      ok: true,
      sentCount: 0,
      cooldownCount: cooldown.coolingDown.length,
      nextReminderAt: cooldown.nextReminderAt,
      message: `These players were reminded in the last ${COMPETITION_REMINDER_COOLDOWN_HOURS} hours.`,
    })
  }

  const bodyText = [
    competitionName,
    currentSnapshot.date,
    currentSnapshot.time ? `at ${currentSnapshot.time}` : '',
    currentSnapshot.location,
  ].filter(Boolean).join(' · ')
  const { error: notificationError } = await auth.supabase.from('internal_notifications').insert(
    cooldown.eligible.map((target) => ({
      recipient_profile_id: target.playerUserId,
      actor_user_id: auth.userId,
      notification_type: 'schedule',
      title: 'Please confirm your availability',
      body: bodyText,
      href: `/compete/schedule#event-${encodeURIComponent(eventId)}`,
    })),
  )
  if (notificationError) {
    return Response.json({ ok: false, message: 'Reminders could not be sent.' }, { status: 500 })
  }


  const sentAt = new Date().toISOString()
  const { error: historyError } = await auth.supabase.from('competition_schedule_reminders').insert(
    cooldown.eligible.map((target) => ({
      organizer_user_id: auth.userId,
      player_user_id: target.playerUserId,
      competition_kind: competitionKind,
      competition_id: competitionId,
      event_id: eventId,
      event_snapshot: currentSnapshot,
      sent_at: sentAt,
    })),
  )

  const sentCount = cooldown.eligible.length
  const cooldownCount = cooldown.coolingDown.length
  const sentMessage = sentCount === 1 ? 'Reminder sent to 1 player.' : `Reminders sent to ${sentCount} players.`
  const cooldownMessage = cooldownCount
    ? ` ${cooldownCount} already reminded in the last ${COMPETITION_REMINDER_COOLDOWN_HOURS} hours.`
    : ''
  return Response.json({
    ok: true,
    sentCount,
    cooldownCount,
    nextReminderAt: cooldown.nextReminderAt,
    sentAt,
    trackingWarning: historyError ? 'Reminder sent, but history could not be saved.' : '',
    message: historyError ? `${sentMessage} Reminder history could not be saved.` : `${sentMessage}${cooldownMessage}`,
  })
}
