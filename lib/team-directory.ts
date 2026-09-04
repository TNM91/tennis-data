'use client'

import { supabase } from '@/lib/supabase'

type TeamMatchRow = {
  id: string
  home_team: string | null
  away_team: string | null
  league_name: string | null
  flight: string | null
  match_date: string | null
  line_number: string | null
}

export type TeamDirectoryOption = {
  key: string
  team: string
  league: string | null
  flight: string | null
  matchCount: number
  mostRecentMatchDate: string | null
  nextMatch?: { date: string; opponent: string } | null
  source?: 'canonical' | 'tennisrecord'
}

type TennisRecordTeamContextRow = {
  team_name: string | null
  league_name: string | null
  flight: string | null
  last_seen_at: string | null
}

const NON_TEAM_LABELS = new Set([
  'match results',
  'home team',
  'away team',
  'visiting team',
  'team name',
  'team',
  'tbd',
  'unknown',
  'n/a',
])

function cleanText(value: string | null | undefined) {
  const text = (value || '').trim()
  return text.length > 0 ? text : null
}

function normalizeName(value: string | null | undefined) {
  return (cleanText(value) || '').replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').toLowerCase()
}

/** Reject source headings and league metadata that have leaked into team columns. */
export function isPublicTeamDirectoryName(value: string | null | undefined, league?: string | null) {
  const name = cleanText(value)
  const normalizedName = normalizeName(value)
  const normalizedLeague = normalizeName(league)
  if (!name || normalizedName.length < 2 || NON_TEAM_LABELS.has(normalizedName)) return false
  if (normalizedLeague && normalizedName === normalizedLeague) return false
  if (/^20\d{2}\s+adult\b/i.test(name)) return false
  return true
}

/**
 * Treat TennisRecord observations as untrusted source material until their
 * team fields pass the stricter name check. Other TenAceIQ sources already
 * provide explicit schedule or upload team fields, so keep those records in
 * the directory unless the value is a known column heading.
 */
export function isPublicTeamDirectoryMatch(match: {
  homeTeam: string | null | undefined
  awayTeam: string | null | undefined
  league?: string | null
  source?: string | null
}) {
  const home = cleanText(match.homeTeam)
  const away = cleanText(match.awayTeam)
  const source = normalizeName(match.source)

  if (!home || !away || NON_TEAM_LABELS.has(normalizeName(home)) || NON_TEAM_LABELS.has(normalizeName(away))) return false

  if (source.includes('tennisrecord')) {
    return isPublicTeamDirectoryName(home, match.league) && isPublicTeamDirectoryName(away, match.league)
  }

  return true
}

/** Source identifiers use underscores (for example, tennislink_schedule). */
export function isScheduleTeamSource(source: string | null | undefined) {
  return normalizeName(source).includes('schedule')
}

/**
 * A local roster is useful to validate locally uploaded schedule rows, but it
 * is not a complete authority over separately sourced TennisRecord evidence.
 * Otherwise a newly discovered public team disappears simply because the
 * local roster for that same league/flight has not been uploaded yet.
 */
export function shouldRestrictTeamDirectoryToLocalRoster(source: string | null | undefined) {
  return !normalizeName(source).includes('tennisrecord')
}

function buildTeamKey(team: string, league: string | null, flight: string | null) {
  return `${team}__${league || ''}__${flight || ''}`
}

function compareNullableDatesDesc(left: string | null, right: string | null) {
  if (!left && !right) return 0
  if (!left) return 1
  if (!right) return -1

  const leftTime = new Date(left).getTime()
  const rightTime = new Date(right).getTime()

  if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0
  if (Number.isNaN(leftTime)) return 1
  if (Number.isNaN(rightTime)) return -1

  return rightTime - leftTime
}

function getLocalIsoDate() {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${today.getFullYear()}-${month}-${day}`
}

function isFutureOrTodayMatch(matchDate: string | null, today = getLocalIsoDate()) {
  return Boolean(matchDate && /^\d{4}-\d{2}-\d{2}$/.test(matchDate) && matchDate >= today)
}

export async function listTeamDirectoryOptions(options?: { teamNames?: string[] }): Promise<TeamDirectoryOption[]> {
  const requestedTeamNames = [...new Set((options?.teamNames || []).map((name) => cleanText(name)).filter((name): name is string => Boolean(name)))]
  const matchQuery = () => supabase
    .from('matches')
    .select('id, home_team, away_team, league_name, flight, match_date, line_number')
    .is('line_number', null)
    .order('match_date', { ascending: false })

  const matchResult = requestedTeamNames.length > 0
    ? await Promise.all([
        matchQuery().in('home_team', requestedTeamNames).limit(2000),
        matchQuery().in('away_team', requestedTeamNames).limit(2000),
      ]).then(([home, away]) => ({
        data: [...((home.data || []) as TeamMatchRow[]), ...((away.data || []) as TeamMatchRow[])],
        error: home.error || away.error,
      }))
    : await matchQuery().limit(10000)

  if (matchResult.error) throw new Error(matchResult.error.message)

  const matches = ((matchResult.data || []) as TeamMatchRow[]).filter((row) => {
    const home = cleanText(row.home_team)
    const away = cleanText(row.away_team)
    return isPublicTeamDirectoryName(home, row.league_name) && isPublicTeamDirectoryName(away, row.league_name)
  })

  const directory = new Map<string, TeamDirectoryOption>()

  for (const match of matches) {
    const home = cleanText(match.home_team)
    const away = cleanText(match.away_team)
    if (!home || !away || !isPublicTeamDirectoryName(home, match.league_name) || !isPublicTeamDirectoryName(away, match.league_name)) continue

    const league = cleanText(match.league_name)
    const flight = cleanText(match.flight)

    for (const team of [home, away]) {
      const key = buildTeamKey(team, league, flight)
      if (!directory.has(key)) {
        directory.set(key, {
          key,
          team,
          league,
          flight,
          matchCount: 0,
          mostRecentMatchDate: null,
          nextMatch: null,
          source: 'canonical',
        })
      }

      const current = directory.get(key)
      if (!current) continue

      current.matchCount += 1
      const opponent = team === home ? away : home
      if (
        isFutureOrTodayMatch(match.match_date)
        && (!current.nextMatch || match.match_date! < current.nextMatch.date)
      ) {
        current.nextMatch = { date: match.match_date!, opponent }
      }
      if (
        compareNullableDatesDesc(match.match_date, current.mostRecentMatchDate) < 0 ||
        current.mostRecentMatchDate === null
      ) {
        current.mostRecentMatchDate = match.match_date
      }
    }
  }

  const tennisRecordContextQuery = supabase
    .from('tennisrecord_public_team_context')
    .select('team_name, league_name, flight, last_seen_at')
  const { data: tennisRecordContext, error: tennisRecordContextError } = requestedTeamNames.length > 0
    ? await tennisRecordContextQuery.in('team_name', requestedTeamNames).limit(2000)
    : await tennisRecordContextQuery.limit(10000)

  // The view is delivered by a separate migration. Preserve existing team
  // discovery if a local environment has not applied it yet.
  if (!tennisRecordContextError) {
    for (const row of (tennisRecordContext || []) as TennisRecordTeamContextRow[]) {
      const team = cleanText(row.team_name)
      const league = cleanText(row.league_name)
      const flight = cleanText(row.flight)
      if (!team || !isPublicTeamDirectoryName(team, league)) continue

      const key = buildTeamKey(team, league, flight)
      if (directory.has(key)) continue

      directory.set(key, {
        key,
        team,
        league,
        flight,
        matchCount: 0,
        mostRecentMatchDate: cleanText(row.last_seen_at),
        nextMatch: null,
        source: 'tennisrecord',
      })
    }
  }

  return Array.from(directory.values()).sort((left, right) => {
    if (right.matchCount !== left.matchCount) return right.matchCount - left.matchCount
    return left.team.localeCompare(right.team)
  })
}
