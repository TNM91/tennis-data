import type { TiqLeagueRecord } from './tiq-league-registry'

export type TiqLeagueSeasonStatus = 'draft' | 'active' | 'completed' | 'archived'

export const DEFAULT_TIQ_LEAGUE_MAX_WEEKS = 12
export const DEFAULT_TIQ_LEAGUE_MAX_MATCH_EVENTS = 120
export const MAX_TIQ_LEAGUE_WEEKS = 12
export const MAX_TIQ_LEAGUE_MATCH_EVENTS = 500
export const MAX_TIQ_TEAM_LEAGUE_TEAMS = 16
export const MAX_TIQ_INDIVIDUAL_LEAGUE_PLAYERS = 64

export function normalizeTiqLeagueSeasonStatus(value: string | null | undefined): TiqLeagueSeasonStatus {
  if (value === 'active' || value === 'completed' || value === 'archived') return value
  return 'draft'
}

export function normalizeTiqLeagueMaxWeeks(value: number | string | null | undefined) {
  if (value == null || value === '') return DEFAULT_TIQ_LEAGUE_MAX_WEEKS
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_TIQ_LEAGUE_MAX_WEEKS
  return Math.min(Math.max(Math.round(parsed), 1), MAX_TIQ_LEAGUE_WEEKS)
}

export function normalizeTiqLeagueMaxMatchEvents(value: number | string | null | undefined) {
  if (value == null || value === '') return DEFAULT_TIQ_LEAGUE_MAX_MATCH_EVENTS
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_TIQ_LEAGUE_MAX_MATCH_EVENTS
  return Math.min(Math.max(Math.round(parsed), 1), MAX_TIQ_LEAGUE_MATCH_EVENTS)
}

export function getTiqLeagueSeasonSummary(record: Pick<TiqLeagueRecord, 'maxWeeks' | 'maxMatchEvents'>) {
  return `${record.maxWeeks} weeks / ${record.maxMatchEvents} match events`
}

function parseUtcDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatUtcDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function calculateTiqLeagueEndsOn(startsOn: string | null | undefined, maxWeeks: number | string | null | undefined) {
  const starts = parseUtcDate(startsOn)
  if (!starts) return ''

  const weeks = normalizeTiqLeagueMaxWeeks(maxWeeks)
  const ends = new Date(starts)
  ends.setUTCDate(ends.getUTCDate() + weeks * 7 - 1)
  return formatUtcDate(ends)
}

export function validateTiqLeagueSeasonWindow(input: {
  startsOn?: string | null
  endsOn?: string | null
  maxWeeks: number
}) {
  if (!input.startsOn || !input.endsOn) return null

  const starts = parseUtcDate(input.startsOn)
  const ends = parseUtcDate(input.endsOn)
  if (!starts || !ends) return null
  if (ends < starts) return 'Season end must be on or after the start date.'

  const days = Math.floor((ends.getTime() - starts.getTime()) / (24 * 60 * 60 * 1000)) + 1
  const weeks = Math.ceil(days / 7)
  if (weeks > input.maxWeeks) {
    return `Season dates span ${weeks} weeks. Raise the max weeks or shorten the season.`
  }

  return null
}

export function validateTiqLeagueParticipantLimit(record: Pick<TiqLeagueRecord, 'leagueFormat' | 'teams' | 'players'>) {
  if (record.leagueFormat === 'team' && record.teams.length > MAX_TIQ_TEAM_LEAGUE_TEAMS) {
    return `Team leagues are capped at ${MAX_TIQ_TEAM_LEAGUE_TEAMS} teams.`
  }
  if (record.leagueFormat === 'individual' && record.players.length > MAX_TIQ_INDIVIDUAL_LEAGUE_PLAYERS) {
    return `Individual leagues are capped at ${MAX_TIQ_INDIVIDUAL_LEAGUE_PLAYERS} players.`
  }
  return null
}

export function getTiqLeagueParticipantCount(record: Pick<TiqLeagueRecord, 'leagueFormat' | 'teams' | 'players'>) {
  return record.leagueFormat === 'team' ? record.teams.length : record.players.length
}

export function getTiqLeagueRoundRobinEventCount(record: Pick<TiqLeagueRecord, 'leagueFormat' | 'teams' | 'players'>) {
  const participantCount = getTiqLeagueParticipantCount(record)
  if (participantCount < 2) return 0
  return (participantCount * (participantCount - 1)) / 2
}

export function getTiqLeagueScheduleCapacitySummary(
  record: Pick<TiqLeagueRecord, 'leagueFormat' | 'teams' | 'players' | 'maxMatchEvents'>,
) {
  const participantCount = getTiqLeagueParticipantCount(record)
  const roundRobinEventCount = getTiqLeagueRoundRobinEventCount(record)
  const participantLabel = record.leagueFormat === 'team' ? 'teams' : 'players'
  const eventLabel = roundRobinEventCount === 1 ? 'match event' : 'match events'

  if (participantCount < 2) {
    return `Add at least two ${participantLabel} to estimate schedule capacity.`
  }

  return `${participantCount} ${participantLabel} need ${roundRobinEventCount} ${eventLabel} for one round robin.`
}

export function validateTiqLeagueScheduleCapacity(
  record: Pick<TiqLeagueRecord, 'leagueFormat' | 'teams' | 'players' | 'maxMatchEvents'>,
) {
  const requiredEvents = getTiqLeagueRoundRobinEventCount(record)
  if (requiredEvents <= 0 || requiredEvents <= record.maxMatchEvents) return null

  return `One round robin needs ${requiredEvents} match events, but this season is capped at ${record.maxMatchEvents}. Raise the max match events or reduce participants.`
}

export function validateTiqLeagueCanAcceptActivity(
  record: Pick<TiqLeagueRecord, 'seasonStatus' | 'startsOn' | 'endsOn' | 'maxMatchEvents'>,
  existingActivityCount: number,
  activityDate?: string | null,
) {
  if (record.seasonStatus === 'completed' || record.seasonStatus === 'archived') {
    return 'This league season is closed. Create a new season or move it back to active before adding results.'
  }

  if (existingActivityCount >= record.maxMatchEvents) {
    return `This league reached its ${record.maxMatchEvents} match event season limit. Create a new season to continue.`
  }

  if (activityDate && record.startsOn && activityDate < record.startsOn) {
    return 'Result date is before the league season starts.'
  }

  if (activityDate && record.endsOn && activityDate > record.endsOn) {
    return 'Result date is after the league season ends. Extend the season or create a new one.'
  }

  return null
}
