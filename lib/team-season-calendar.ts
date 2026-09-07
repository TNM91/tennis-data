import { buildTeamScheduleCalendarItems, normalizeScheduleCalendarDate } from './team-schedule-calendar'

export type TeamSeasonMatch = {
  id: string
  external_match_id?: string | null
  home_team: string | null
  away_team: string | null
  match_date: string | null
  match_time?: string | null
  facility?: string | null
  league_name?: string | null
  flight?: string | null
  match_type?: string | null
  line_number?: string | null
  status?: string | null
}

// Only team fixtures belong on a season calendar, never individual court results.
export function buildTeamSeasonCalendars(team: string, matches: TeamSeasonMatch[], ownerId: string) {
  const groups = new Map<string, { key: string; label: string; year: string; league: string; matches: TeamSeasonMatch[] }>()
  for (const match of matches) {
    if (match.home_team !== team && match.away_team !== team) continue
    if (match.line_number || match.match_type || /^(cancelled|canceled|postponed)$/i.test(match.status || '')) continue
    const date = normalizeScheduleCalendarDate(match.match_date)
    const parsed = new Date(`${date}T12:00:00Z`)
    if (!date || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) continue
    const year = date.slice(0, 4)
    const league = (match.league_name || '').trim()
    // A named league season is not a calendar year: Fall 2027 can start in
    // September 2026. Keep the complete season together across New Year's Day.
    // Without an explicit season year, retain year isolation for reused names.
    const leagueYear = /\b(20\d{2})\b/.exec(league)?.[1]
    const seasonYear = leagueYear || year
    const key = JSON.stringify([seasonYear, league, match.flight || ''])
    const group = groups.get(key) || { key, year: seasonYear, league, label: [leagueYear ? '' : year, league, match.flight].filter(Boolean).join(' · '), matches: [] }
    group.matches.push(match)
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => b.year.localeCompare(a.year) || a.label.localeCompare(b.label)).map((group) => ({
    key: group.key,
    label: group.label,
    items: buildTeamScheduleCalendarItems({
      teamName: team,
      leagueName: group.league,
      calendarOwnerId: ownerId,
      matches: group.matches.map((match) => ({
        externalMatchId: match.external_match_id || match.id,
        matchDate: match.match_date || '',
        matchTime: match.match_time || '',
        homeTeam: match.home_team || '',
        awayTeam: match.away_team || '',
        facility: match.facility || '',
      })),
    }).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
  }))
}

export function formatSeasonDateRange(items: Array<{ date: string }>) {
  const dates = items.map((item) => normalizeScheduleCalendarDate(item.date)).filter(Boolean).sort()
  if (!dates.length) return ''
  const format = (date: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
  return dates[0] === dates.at(-1) ? format(dates[0]) : `${format(dates[0])} – ${format(dates.at(-1)!)}`
}
