type Fixture = {
  home_team: string | null
  away_team: string | null
  league_name?: string | null
  flight?: string | null
  match_date: string | null
  winner_side: string | null
}

function fixtureKey(match: Fixture) {
  const normalize = (value: string | null | undefined) => value?.trim().replace(/\s+/g, ' ').toLowerCase() || ''
  const date = match.match_date?.slice(0, 10)
  if (!date || !match.home_team?.trim() || !match.away_team?.trim()) return null
  return JSON.stringify([date, normalize(match.league_name), normalize(match.flight), normalize(match.home_team), normalize(match.away_team)])
}

/** A result supersedes an imported schedule row for the same scoped fixture. */
export function reconcileTeamProfileFixtures<T extends Fixture>(matches: T[]): T[] {
  const completed = new Set(matches.filter(match => match.winner_side === 'A' || match.winner_side === 'B').map(fixtureKey).filter((key): key is string => key !== null))
  return matches.filter(match => {
    if (match.winner_side === 'A' || match.winner_side === 'B') return true
    const key = fixtureKey(match)
    return key === null || !completed.has(key)
  })
}
