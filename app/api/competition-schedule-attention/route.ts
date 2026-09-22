import {
  buildOrganizerScheduleAttentionItems,
  type OrganizerScheduleEvent,
  type OrganizerScheduleResponseRow,
} from '../../../lib/competition-schedule-attention'
import { getSignedInPlayerApiAuth } from '@/lib/player-api-auth'
import { buildTournamentScheduleMatches } from '../../../lib/player-competition-schedule'
import type { CompetitionReminderHistoryRow } from '../../../lib/competition-schedule-reminder-cooldown'

export const runtime = 'nodejs'

type LeagueRow = {
  id?: string | null
  league_name?: string | null
  default_facility?: string | null
  location_label?: string | null
}

type LeagueScheduleRow = {
  id?: string | null
  league_id?: string | null
  participant_a_name?: string | null
  participant_b_name?: string | null
  scheduled_date?: string | null
  scheduled_time?: string | null
  facility?: string | null
  status?: string | null
}

type TournamentRow = {
  id?: string | null
  name?: string | null
  format?: string | null
  entrants?: string[] | null
  results?: Record<string, { winner?: string | null }> | null
  schedule?: Record<string, { date?: string | null; time?: string | null; court?: string | null }> | null
  location_label?: string | null
}

type EntryRow = {
  league_id?: string | null
  tournament_id?: string | null
  player_name?: string | null
  created_by_user_id?: string | null
  submitted_by_user_id?: string | null
}

type ResponseRow = {
  competition_kind?: string | null
  competition_id?: string | null
  event_id?: string | null
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

function buildEntryLookup(rows: EntryRow[], kind: 'league' | 'tournament') {
  const lookup = new Map<string, Map<string, { userId: string; playerName: string }>>()
  for (const row of rows) {
    const competitionId = cleanText(kind === 'league' ? row.league_id : row.tournament_id)
    const userId = cleanText(kind === 'league' ? row.created_by_user_id : row.submitted_by_user_id)
    const playerName = cleanText(row.player_name)
    if (!competitionId || !userId || !playerName) continue
    const entries = lookup.get(competitionId) ?? new Map()
    entries.set(normalizeName(playerName), { userId, playerName })
    lookup.set(competitionId, entries)
  }
  return lookup
}

export async function GET(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  const today = new Date().toISOString().slice(0, 10)
  const [leagueResult, tournamentResult] = await Promise.all([
    auth.supabase
      .from('tiq_leagues')
      .select('id,league_name,default_facility,location_label')
      .eq('created_by_user_id', auth.userId)
      .eq('league_format', 'individual'),
    auth.supabase
      .from('tiq_tournaments')
      .select('id,name,format,entrants,results,schedule,location_label')
      .eq('created_by_user_id', auth.userId)
      .eq('entrant_type', 'players'),
  ])
  if (leagueResult.error || tournamentResult.error) {
    return Response.json({ ok: false, message: 'Schedule attention could not load.' }, { status: 500 })
  }

  const leagues = (leagueResult.data ?? []) as LeagueRow[]
  const tournaments = (tournamentResult.data ?? []) as TournamentRow[]
  const leagueIds = leagues.map((row) => cleanText(row.id)).filter(Boolean)
  const tournamentIds = tournaments.map((row) => cleanText(row.id)).filter(Boolean)

  const [
    leagueScheduleResult,
    leagueEntryResult,
    tournamentEntryResult,
    leagueResponseResult,
    tournamentResponseResult,
    leagueReminderResult,
    tournamentReminderResult,
  ] = await Promise.all([
    leagueIds.length
      ? auth.supabase
          .from('tiq_league_schedule_items')
          .select('id,league_id,participant_a_name,participant_b_name,scheduled_date,scheduled_time,facility,status')
          .in('league_id', leagueIds)
          .in('status', ['confirmed', 'coordinator_set'])
          .gte('scheduled_date', today)
      : Promise.resolve({ data: [], error: null }),
    leagueIds.length
      ? auth.supabase
          .from('tiq_player_league_entries')
          .select('league_id,player_name,created_by_user_id')
          .in('league_id', leagueIds)
          .eq('entry_status', 'active')
      : Promise.resolve({ data: [], error: null }),
    tournamentIds.length
      ? auth.supabase
          .from('tiq_tournament_entries')
          .select('tournament_id,player_name,submitted_by_user_id')
          .in('tournament_id', tournamentIds)
          .eq('status', 'approved')
      : Promise.resolve({ data: [], error: null }),
    leagueIds.length
      ? auth.supabase
          .from('player_schedule_responses')
          .select('competition_kind,competition_id,event_id,player_user_id,response,event_snapshot')
          .eq('competition_kind', 'league')
          .in('competition_id', leagueIds)
      : Promise.resolve({ data: [], error: null }),
    tournamentIds.length
      ? auth.supabase
          .from('player_schedule_responses')
          .select('competition_kind,competition_id,event_id,player_user_id,response,event_snapshot')
          .eq('competition_kind', 'tournament')
          .in('competition_id', tournamentIds)
      : Promise.resolve({ data: [], error: null }),
    leagueIds.length
      ? auth.supabase
          .from('competition_schedule_reminders')
          .select('event_id,player_user_id,event_snapshot,sent_at')
          .eq('organizer_user_id', auth.userId)
          .eq('competition_kind', 'league')
          .in('competition_id', leagueIds)
      : Promise.resolve({ data: [], error: null }),
    tournamentIds.length
      ? auth.supabase
          .from('competition_schedule_reminders')
          .select('event_id,player_user_id,event_snapshot,sent_at')
          .eq('organizer_user_id', auth.userId)
          .eq('competition_kind', 'tournament')
          .in('competition_id', tournamentIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const loadError = [
    leagueScheduleResult.error,
    leagueEntryResult.error,
    tournamentEntryResult.error,
    leagueResponseResult.error,
    tournamentResponseResult.error,
    leagueReminderResult.error,
    tournamentReminderResult.error,
  ].find(Boolean)
  if (loadError) {
    return Response.json({ ok: false, message: 'Schedule replies could not load.' }, { status: 500 })
  }

  const leagueById = new Map(leagues.map((row) => [cleanText(row.id), row]))
  const leagueEntries = buildEntryLookup((leagueEntryResult.data ?? []) as EntryRow[], 'league')
  const tournamentEntries = buildEntryLookup((tournamentEntryResult.data ?? []) as EntryRow[], 'tournament')
  const events: OrganizerScheduleEvent[] = []

  for (const schedule of (leagueScheduleResult.data ?? []) as LeagueScheduleRow[]) {
    const competitionId = cleanText(schedule.league_id)
    const eventRecordId = cleanText(schedule.id)
    const league = leagueById.get(competitionId)
    if (!competitionId || !eventRecordId || !league) continue
    const entryLookup = leagueEntries.get(competitionId) ?? new Map()
    const players = [schedule.participant_a_name, schedule.participant_b_name].flatMap((name) => {
      const entry = entryLookup.get(normalizeName(name))
      return entry ? [entry] : []
    })
    events.push({
      eventId: `league:${competitionId}:${eventRecordId}`,
      competitionKind: 'league',
      competitionId,
      competitionName: cleanText(league.league_name) || 'TIQ league',
      matchLabel: `${cleanText(schedule.participant_a_name)} vs ${cleanText(schedule.participant_b_name)}`,
      date: cleanText(schedule.scheduled_date),
      time: cleanText(schedule.scheduled_time),
      location: cleanText(schedule.facility) || cleanText(league.default_facility) || cleanText(league.location_label),
      href: `/explore/leagues/tiq/${encodeURIComponent(competitionId)}#league-schedule`,
      players,
    })
  }

  for (const tournament of tournaments) {
    const competitionId = cleanText(tournament.id)
    if (!competitionId) continue
    const entryLookup = tournamentEntries.get(competitionId) ?? new Map()
    for (const match of buildTournamentScheduleMatches(tournament)) {
      const date = cleanText(match.schedule?.date)
      const sideAPlayable = cleanText(match.sideA) !== 'Bye' && !cleanText(match.sideA).startsWith('Winner ')
      const sideBPlayable = cleanText(match.sideB) !== 'Bye' && !cleanText(match.sideB).startsWith('Winner ')
      if (!date || !sideAPlayable || !sideBPlayable) continue
      const players = [match.sideA, match.sideB].flatMap((name) => {
        const entry = entryLookup.get(normalizeName(name))
        return entry ? [entry] : []
      })
      const court = cleanText(match.schedule?.court)
      events.push({
        eventId: `tournament:${competitionId}:${match.id}`,
        competitionKind: 'tournament',
        competitionId,
        competitionName: cleanText(tournament.name) || 'TIQ tournament',
        matchLabel: `${match.sideA} vs ${match.sideB}`,
        date,
        time: cleanText(match.schedule?.time),
        location: [cleanText(tournament.location_label), court ? `Court ${court}` : ''].filter(Boolean).join(' · '),
        href: `/league-coordinator/tournaments?tournamentId=${encodeURIComponent(competitionId)}#tournament-schedule-${encodeURIComponent(match.id)}`,
        players,
      })
    }
  }

  const responses = [
    ...((leagueResponseResult.data ?? []) as ResponseRow[]),
    ...((tournamentResponseResult.data ?? []) as ResponseRow[]),
  ].flatMap((row): OrganizerScheduleResponseRow[] => {
    const response = row.response === 'available' || row.response === 'unavailable' ? row.response : null
    const eventId = cleanText(row.event_id)
    const playerUserId = cleanText(row.player_user_id)
    if (!response || !eventId || !playerUserId) return []
    const snapshot = row.event_snapshot ?? {}
    return [{
      eventId,
      playerUserId,
      response,
      eventSnapshot: {
        date: cleanText(snapshot.date),
        time: cleanText(snapshot.time),
        location: cleanText(snapshot.location),
      },
    }]
  })
  const reminderHistory = [
    ...((leagueReminderResult.data ?? []) as ReminderRow[]),
    ...((tournamentReminderResult.data ?? []) as ReminderRow[]),
  ].flatMap((row): CompetitionReminderHistoryRow[] => {
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
  const items = buildOrganizerScheduleAttentionItems({ events, responses, reminderHistory, today })

  return Response.json({
    ok: true,
    competitionCount: leagues.length + tournaments.length,
    itemCount: items.length,
    items: items.slice(0, 12),
  })
}
