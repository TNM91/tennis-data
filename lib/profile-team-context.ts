import { cleanText } from './captain-formatters'
import { buildScopedTeamEntityId } from './entity-ids'
import { buildTeamProfileHref } from './team-routes'

type ProfileMatch = {
  id: string
  flight: string | null
  league_name: string | null
  home_team: string | null
  away_team: string | null
}

export type ProfileMatchContextRow = {
  side: string | null
  matches: ProfileMatch | ProfileMatch[] | null
}

export type ProfileMatchContext = {
  playerId: string
  status: 'ready' | 'error'
  rows: ProfileMatchContextRow[]
}

export function getProfileMatchDataState(
  playerId: string,
  context: ProfileMatchContext | null,
): 'checking' | 'error' | 'present' | 'missing' {
  if (!playerId) return 'missing'
  if (!context || context.playerId !== playerId) return 'checking'
  if (context.status === 'error') return 'error'
  return context.rows.length ? 'present' : 'missing'
}

export type ProfileTeamSummary = {
  id: string
  name: string
  league: string
  flight: string
  href: string
}

export function buildProfileTeamSummaries(rows: ProfileMatchContextRow[]): ProfileTeamSummary[] {
  const teams = new Map<string, ProfileTeamSummary>()

  for (const row of rows) {
    const match = Array.isArray(row.matches) ? row.matches[0] : row.matches
    if (!match || (row.side !== 'A' && row.side !== 'B')) continue

    const teamName = cleanText(row.side === 'A' ? match.home_team : match.away_team)
    const league = cleanText(match.league_name)
    const flight = cleanText(match.flight)
    if (!teamName) continue

    const id = buildScopedTeamEntityId({
      competitionLayer: '',
      teamName,
      leagueName: league,
      flight,
    })
    if (!teams.has(id)) {
      teams.set(id, {
        id,
        name: teamName,
        league,
        flight,
        href: buildTeamProfileHref(teamName, { league, flight }),
      })
    }
  }

  return [...teams.values()].sort((a, b) => a.name.localeCompare(b.name))
}
