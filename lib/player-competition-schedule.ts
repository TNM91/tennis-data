import type { SupabaseClient } from '@supabase/supabase-js'
import type { TennisCalendarEvent } from '@/lib/tiq-league-schedule-calendar'

export type PlayerCompetitionScheduleEvent = {
  id: string
  kind: 'tournament' | 'league'
  eventType: 'match' | 'competition'
  competitionId: string
  competitionName: string
  title: string
  date: string
  time: string
  location: string
  opponent: string
  detail: string
  href: string
  status: string
  responseStatus?: '' | 'available' | 'unavailable'
  responseUpdatedAt?: string
  responseIsStale?: boolean
}

type ScheduleResponseRow = {
  event_id?: string | null
  response?: string | null
  event_snapshot?: Record<string, unknown> | null
  updated_at?: string | null
}

type TournamentEntryRow = {
  id?: string | null
  tournament_id?: string | null
  player_name?: string | null
  linked_player_id?: string | null
}

type LeagueEntryRow = {
  id?: string | null
  league_id?: string | null
  player_name?: string | null
  player_id?: string | null
}

type TournamentSchedule = {
  date?: string | null
  time?: string | null
  court?: string | null
}

type TournamentResult = {
  winner?: string | null
}

type TournamentRow = {
  id?: string | null
  name?: string | null
  format?: string | null
  starts_on?: string | null
  location_label?: string | null
  entrants?: string[] | null
  results?: Record<string, TournamentResult> | null
  schedule?: Record<string, TournamentSchedule> | null
}

type LeagueRow = {
  id?: string | null
  league_name?: string | null
  season_label?: string | null
  starts_on?: string | null
  location_label?: string | null
  default_facility?: string | null
}

type LeagueScheduleRow = {
  id?: string | null
  league_id?: string | null
  participant_a_name?: string | null
  participant_a_id?: string | null
  participant_b_name?: string | null
  participant_b_id?: string | null
  scheduled_date?: string | null
  scheduled_time?: string | null
  facility?: string | null
  status?: string | null
  notes?: string | null
}

type TournamentMatch = {
  id: string
  label: string
  sideA: string
  sideB: string
  schedule?: TournamentSchedule
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function normalizeName(value: unknown) {
  return cleanText(value).toLocaleLowerCase()
}

function normalizeEntrants(values: string[] | null | undefined) {
  return Array.from(new Set((values ?? []).map(cleanText).filter(Boolean)))
}

function buildMatchId(round: number, court: number) {
  return `r${round}-m${court}`
}

function buildSingleEliminationMatches(row: TournamentRow): TournamentMatch[] {
  const field = normalizeEntrants(row.entrants)
  if (field.length < 2) return []

  const bracketSize = Math.pow(2, Math.ceil(Math.log2(field.length)))
  const seeded = [...field, ...Array.from({ length: bracketSize - field.length }, () => 'Bye')]
  const winners = new Map<string, string>()
  const matches: TournamentMatch[] = []
  const results = row.results ?? {}
  const schedule = row.schedule ?? {}

  for (let index = 0; index < bracketSize / 2; index += 1) {
    const id = buildMatchId(1, index + 1)
    const sideA = seeded[index]
    const sideB = seeded[bracketSize - 1 - index]
    const byeWinner = sideA === 'Bye' ? sideB : sideB === 'Bye' ? sideA : ''
    const winner = byeWinner || cleanText(results[id]?.winner)
    if (winner) winners.set(id, winner)
    matches.push({ id, label: 'Round 1', sideA, sideB, schedule: schedule[id] })
  }

  let remaining = bracketSize / 4
  let round = 2
  while (remaining >= 1) {
    for (let index = 0; index < remaining; index += 1) {
      const id = buildMatchId(round, index + 1)
      const previousLeft = buildMatchId(round - 1, index * 2 + 1)
      const previousRight = buildMatchId(round - 1, index * 2 + 2)
      const sideA = winners.get(previousLeft) || `Winner R${round - 1}.${index * 2 + 1}`
      const sideB = winners.get(previousRight) || `Winner R${round - 1}.${index * 2 + 2}`
      const winner = cleanText(results[id]?.winner)
      if (winner === sideA || winner === sideB) winners.set(id, winner)
      matches.push({
        id,
        label: remaining === 1 ? 'Final' : `Round ${round}`,
        sideA,
        sideB,
        schedule: schedule[id],
      })
    }
    remaining /= 2
    round += 1
  }

  return matches
}

function buildRoundRobinMatches(row: TournamentRow): TournamentMatch[] {
  const field = normalizeEntrants(row.entrants)
  if (field.length < 2) return []

  const rotating = field.length % 2 === 0 ? [...field] : [...field, 'Bye']
  const rounds = rotating.length - 1
  const half = rotating.length / 2
  const matches: TournamentMatch[] = []
  const schedule = row.schedule ?? {}

  for (let round = 1; round <= rounds; round += 1) {
    for (let index = 0; index < half; index += 1) {
      const sideA = rotating[index]
      const sideB = rotating[rotating.length - 1 - index]
      if (sideA !== 'Bye' && sideB !== 'Bye') {
        const id = buildMatchId(round, index + 1)
        matches.push({ id, label: `Round ${round}`, sideA, sideB, schedule: schedule[id] })
      }
    }
    rotating.splice(1, 0, rotating.pop() || '')
  }

  return matches
}

function buildTournamentMatches(row: TournamentRow) {
  return row.format === 'round_robin' ? buildRoundRobinMatches(row) : buildSingleEliminationMatches(row)
}

function isSameParticipant(entry: LeagueEntryRow, name: unknown, id: unknown) {
  const entryId = cleanText(entry.player_id)
  const participantId = cleanText(id)
  if (entryId && participantId && entryId === participantId) return true
  return Boolean(normalizeName(entry.player_name) && normalizeName(entry.player_name) === normalizeName(name))
}

function sortEvents(events: PlayerCompetitionScheduleEvent[]) {
  return [...events].sort((left, right) => {
    const leftKey = `${left.date || '9999-12-31'}T${left.time || '23:59'}:${left.title}`
    const rightKey = `${right.date || '9999-12-31'}T${right.time || '23:59'}:${right.title}`
    return leftKey.localeCompare(rightKey)
  })
}

export function mapApprovedCompetitionSchedule(input: {
  tournamentEntries: TournamentEntryRow[]
  tournaments: TournamentRow[]
  leagueEntries: LeagueEntryRow[]
  leagues: LeagueRow[]
  leagueSchedule: LeagueScheduleRow[]
  responses?: ScheduleResponseRow[]
}): PlayerCompetitionScheduleEvent[] {
  const tournamentById = new Map(input.tournaments.map((row) => [cleanText(row.id), row]))
  const leagueById = new Map(input.leagues.map((row) => [cleanText(row.id), row]))
  const events: PlayerCompetitionScheduleEvent[] = []

  for (const entry of input.tournamentEntries) {
    const competitionId = cleanText(entry.tournament_id)
    const tournament = tournamentById.get(competitionId)
    if (!competitionId || !tournament) continue

    const competitionName = cleanText(tournament.name) || 'TIQ tournament'
    const playerName = normalizeName(entry.player_name)
    const playerMatches = buildTournamentMatches(tournament).filter((match) =>
      playerName && (normalizeName(match.sideA) === playerName || normalizeName(match.sideB) === playerName),
    )
    const scheduledMatches = playerMatches.filter((match) => cleanText(match.schedule?.date))

    for (const match of scheduledMatches) {
      const isSideA = normalizeName(match.sideA) === playerName
      const opponent = isSideA ? match.sideB : match.sideA
      const court = cleanText(match.schedule?.court)
      events.push({
        id: `tournament:${competitionId}:${match.id}`,
        kind: 'tournament',
        eventType: 'match',
        competitionId,
        competitionName,
        title: `${competitionName}: ${cleanText(opponent) ? `vs ${opponent}` : match.label}`,
        date: cleanText(match.schedule?.date),
        time: cleanText(match.schedule?.time),
        location: [cleanText(tournament.location_label), court ? `Court ${court}` : ''].filter(Boolean).join(' · '),
        opponent: cleanText(opponent),
        detail: [match.label, court ? `Court ${court}` : ''].filter(Boolean).join(' · '),
        href: `/tournaments/${encodeURIComponent(competitionId)}`,
        status: 'Scheduled',
      })
    }

    if (!scheduledMatches.length && cleanText(tournament.starts_on)) {
      events.push({
        id: `tournament:${competitionId}:start`,
        kind: 'tournament',
        eventType: 'competition',
        competitionId,
        competitionName,
        title: competitionName,
        date: cleanText(tournament.starts_on),
        time: '',
        location: cleanText(tournament.location_label),
        opponent: '',
        detail: 'Entry approved · Match time pending',
        href: `/tournaments/${encodeURIComponent(competitionId)}`,
        status: 'Approved',
      })
    }
  }

  for (const entry of input.leagueEntries) {
    const competitionId = cleanText(entry.league_id)
    const league = leagueById.get(competitionId)
    if (!competitionId || !league) continue

    const competitionName = cleanText(league.league_name) || 'TIQ league'
    const matchingSchedule = input.leagueSchedule.filter((item) => {
      if (cleanText(item.league_id) !== competitionId) return false
      if (!['confirmed', 'coordinator_set', 'completed'].includes(cleanText(item.status))) return false
      return isSameParticipant(entry, item.participant_a_name, item.participant_a_id)
        || isSameParticipant(entry, item.participant_b_name, item.participant_b_id)
    })

    for (const item of matchingSchedule) {
      const isSideA = isSameParticipant(entry, item.participant_a_name, item.participant_a_id)
      const opponent = isSideA ? cleanText(item.participant_b_name) : cleanText(item.participant_a_name)
      events.push({
        id: `league:${competitionId}:${cleanText(item.id)}`,
        kind: 'league',
        eventType: 'match',
        competitionId,
        competitionName,
        title: `${competitionName}: ${opponent ? `vs ${opponent}` : 'League match'}`,
        date: cleanText(item.scheduled_date),
        time: cleanText(item.scheduled_time),
        location: cleanText(item.facility) || cleanText(league.default_facility) || cleanText(league.location_label),
        opponent,
        detail: cleanText(item.notes) || cleanText(league.season_label) || 'League match',
        href: `/explore/leagues/tiq/${encodeURIComponent(competitionId)}`,
        status: cleanText(item.status) === 'completed' ? 'Completed' : 'Confirmed',
      })
    }

    if (!matchingSchedule.length && cleanText(league.starts_on)) {
      events.push({
        id: `league:${competitionId}:start`,
        kind: 'league',
        eventType: 'competition',
        competitionId,
        competitionName,
        title: competitionName,
        date: cleanText(league.starts_on),
        time: '',
        location: cleanText(league.default_facility) || cleanText(league.location_label),
        opponent: '',
        detail: [cleanText(league.season_label), 'Entry approved · Match time pending'].filter(Boolean).join(' · '),
        href: `/explore/leagues/tiq/${encodeURIComponent(competitionId)}`,
        status: 'Approved',
      })
    }
  }

  const responseByEventId = new Map((input.responses ?? []).map((row) => [cleanText(row.event_id), row]))
  return sortEvents(events.map((event) => {
    const response = responseByEventId.get(event.id)
    const snapshot = response?.event_snapshot ?? {}
    const responseStatus = response?.response === 'available' || response?.response === 'unavailable'
      ? response.response
      : ''
    const responseIsStale = Boolean(responseStatus) && (
      cleanText(snapshot.date) !== event.date
      || cleanText(snapshot.time) !== event.time
      || cleanText(snapshot.location) !== event.location
    )

    return {
      ...event,
      responseStatus: responseIsStale ? '' : responseStatus,
      responseUpdatedAt: cleanText(response?.updated_at),
      responseIsStale,
    }
  }))
}

export async function loadPlayerCompetitionSchedule(client: SupabaseClient, userId: string) {
  const profileId = cleanText(userId)
  if (!profileId) return []

  const [tournamentEntriesResult, leagueEntriesResult, responseResult] = await Promise.all([
    client
      .from('tiq_tournament_entries')
      .select('id,tournament_id,player_name,linked_player_id')
      .eq('submitted_by_user_id', profileId)
      .eq('status', 'approved'),
    client
      .from('tiq_player_league_entries')
      .select('id,league_id,player_name,player_id')
      .eq('created_by_user_id', profileId)
      .eq('entry_status', 'active'),
    client
      .from('player_schedule_responses')
      .select('event_id,response,event_snapshot,updated_at')
      .eq('player_user_id', profileId),
  ])

  if (tournamentEntriesResult.error) throw tournamentEntriesResult.error
  if (leagueEntriesResult.error) throw leagueEntriesResult.error
  if (responseResult.error) throw responseResult.error

  const tournamentEntries = (tournamentEntriesResult.data ?? []) as TournamentEntryRow[]
  const leagueEntries = (leagueEntriesResult.data ?? []) as LeagueEntryRow[]
  const tournamentIds = Array.from(new Set(tournamentEntries.map((entry) => cleanText(entry.tournament_id)).filter(Boolean)))
  const leagueIds = Array.from(new Set(leagueEntries.map((entry) => cleanText(entry.league_id)).filter(Boolean)))

  const [tournamentResult, leagueResult, leagueScheduleResult] = await Promise.all([
    tournamentIds.length
      ? client.from('tiq_tournaments').select('id,name,format,starts_on,location_label,entrants,results,schedule').in('id', tournamentIds)
      : Promise.resolve({ data: [], error: null }),
    leagueIds.length
      ? client.from('tiq_leagues').select('id,league_name,season_label,starts_on,location_label,default_facility').in('id', leagueIds)
      : Promise.resolve({ data: [], error: null }),
    leagueIds.length
      ? client
          .from('tiq_league_schedule_items')
          .select('id,league_id,participant_a_name,participant_a_id,participant_b_name,participant_b_id,scheduled_date,scheduled_time,facility,status,notes')
          .in('league_id', leagueIds)
          .neq('status', 'cancelled')
          .order('scheduled_date', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ])

  if (tournamentResult.error) throw tournamentResult.error
  if (leagueResult.error) throw leagueResult.error
  if (leagueScheduleResult.error) throw leagueScheduleResult.error

  return mapApprovedCompetitionSchedule({
    tournamentEntries,
    tournaments: (tournamentResult.data ?? []) as TournamentRow[],
    leagueEntries,
    leagues: (leagueResult.data ?? []) as LeagueRow[],
    leagueSchedule: (leagueScheduleResult.data ?? []) as LeagueScheduleRow[],
    responses: (responseResult.data ?? []) as ScheduleResponseRow[],
  })
}

export function buildPlayerCompetitionCalendarEvent(
  item: PlayerCompetitionScheduleEvent,
  absoluteUrl: (href: string) => string,
): TennisCalendarEvent {
  return {
    id: `player-${item.id}`,
    title: item.title,
    date: item.date,
    time: item.time,
    location: item.location,
    description: [item.status, item.detail, item.opponent ? `Opponent: ${item.opponent}` : ''].filter(Boolean).join('\n'),
    url: absoluteUrl(item.href),
    durationMinutes: item.time ? 90 : undefined,
  }
}
