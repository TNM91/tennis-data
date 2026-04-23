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
}

function cleanText(value: string | null | undefined) {
  const text = (value || '').trim()
  return text.length > 0 ? text : null
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

export async function listTeamDirectoryOptions(): Promise<TeamDirectoryOption[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('id, home_team, away_team, league_name, flight, match_date, line_number')
    .is('line_number', null)
    .order('match_date', { ascending: false })
    .limit(10000)

  if (error) throw new Error(error.message)

  const matches = ((data || []) as TeamMatchRow[]).filter((row) => {
    const home = cleanText(row.home_team)
    const away = cleanText(row.away_team)
    return Boolean(home && away)
  })

  const directory = new Map<string, TeamDirectoryOption>()

  for (const match of matches) {
    const home = cleanText(match.home_team)
    const away = cleanText(match.away_team)
    if (!home || !away) continue

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
        })
      }

      const current = directory.get(key)
      if (!current) continue

      current.matchCount += 1
      if (
        compareNullableDatesDesc(match.match_date, current.mostRecentMatchDate) < 0 ||
        current.mostRecentMatchDate === null
      ) {
        current.mostRecentMatchDate = match.match_date
      }
    }
  }

  return Array.from(directory.values()).sort((left, right) => {
    if (right.matchCount !== left.matchCount) return right.matchCount - left.matchCount
    return left.team.localeCompare(right.team)
  })
}
