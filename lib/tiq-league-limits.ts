import type { TiqLeagueRecord } from './tiq-league-registry'

export type TiqLeagueSeasonStatus = 'draft' | 'active' | 'completed' | 'archived'

export const DEFAULT_TIQ_LEAGUE_MAX_WEEKS = 12
export const DEFAULT_TIQ_LEAGUE_MAX_MATCH_EVENTS = 120
export const MAX_TIQ_LEAGUE_WEEKS = 52
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

export function validateTiqLeagueSeasonWindow(input: {
  startsOn?: string | null
  endsOn?: string | null
  maxWeeks: number
}) {
  if (!input.startsOn || !input.endsOn) return null

  const starts = new Date(`${input.startsOn}T00:00:00Z`)
  const ends = new Date(`${input.endsOn}T00:00:00Z`)
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) return null
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
