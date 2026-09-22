import type { TeamConnection } from './team-profile-links'

export type CaptainManagedTeamOption = {
  team: string
  league: string
  flight: string
  matches: number
  isDefault: boolean
}

type CaptainScheduledMatch = {
  id: string
  match_date: string | null
  match_time?: string | null
}

export function captainTeamScopeKey(input: {
  team?: string | null
  league?: string | null
  flight?: string | null
}) {
  const parts = [input.team, input.league, input.flight]
    .map((value) => clean(value).toLowerCase())
  return parts.some(Boolean) ? parts.join('__') : ''
}

export function buildCaptainManagedTeamOptions(connections: TeamConnection[]) {
  const byScope = new Map<string, CaptainManagedTeamOption>()

  for (const connection of connections) {
    const team = clean(connection.teamName)
    const league = clean(connection.leagueName)
    const flight = clean(connection.flight)
    const managesTeam = connection.roles.includes('captain') || connection.roles.includes('co_captain')
    if (connection.status !== 'accepted' || connection.archivedAt || !managesTeam || !team || !league || !flight) continue

    const key = captainTeamScopeKey({ team, league, flight })
    const existing = byScope.get(key)
    byScope.set(key, {
      team,
      league,
      flight,
      matches: 0,
      isDefault: Boolean(existing?.isDefault || connection.isDefault),
    })
  }

  return [...byScope.values()].sort((left, right) => (
    Number(right.isDefault) - Number(left.isDefault)
    || left.team.localeCompare(right.team)
    || right.league.localeCompare(left.league)
    || left.flight.localeCompare(right.flight)
  ))
}

export function chooseCaptainManagedTeam(
  options: CaptainManagedTeamOption[],
  requested: { team?: string | null; league?: string | null; flight?: string | null },
) {
  const requestedTeam = clean(requested.team).toLowerCase()
  if (requestedTeam) {
    const sameTeam = options.filter((option) => clean(option.team).toLowerCase() === requestedTeam)
    const exact = sameTeam.find((option) => (
      (!clean(requested.league) || clean(option.league).toLowerCase() === clean(requested.league).toLowerCase())
      && (!clean(requested.flight) || clean(option.flight).toLowerCase() === clean(requested.flight).toLowerCase())
    ))
    if (exact) return exact
    if (sameTeam.length === 1) return sameTeam[0]
  }

  return options.find((option) => option.isDefault) || options[0] || null
}

export function orderCaptainScheduledMatches<T extends CaptainScheduledMatch>(matches: T[], now = new Date()) {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const todayTime = today.getTime()

  return [...matches].sort((left, right) => {
    const leftTime = matchTime(left)
    const rightTime = matchTime(right)
    const leftValid = Number.isFinite(leftTime)
    const rightValid = Number.isFinite(rightTime)
    if (leftValid !== rightValid) return leftValid ? -1 : 1
    if (!leftValid) return left.id.localeCompare(right.id)
    const leftUpcoming = leftTime >= todayTime
    const rightUpcoming = rightTime >= todayTime

    if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1
    if (leftUpcoming) return leftTime - rightTime || left.id.localeCompare(right.id)
    return rightTime - leftTime || left.id.localeCompare(right.id)
  })
}

function matchTime(match: CaptainScheduledMatch) {
  const date = clean(match.match_date)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Number.POSITIVE_INFINITY
  const time = /^\d{2}:\d{2}/.test(clean(match.match_time)) ? clean(match.match_time).slice(0, 5) : '12:00'
  const value = new Date(`${date}T${time}:00`).getTime()
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
