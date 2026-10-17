type MatchOption = {
  id: string
  home_team: string | null
  away_team: string | null
  match_date: string | null
  league_name: string | null
  flight: string | null
  winner_side?: string | null
}

/** Keep one fixture option without changing a saved selection's identity. */
export function uniqueCaptainMatchOptions<T extends MatchOption>(matches: T[], selectedId: string) {
  const groups = new Map<string, T>()
  const normalize = (value: string | null) => (value || '').trim().replace(/\s+/g, ' ').toLowerCase()
  for (const match of matches) {
    const key = match.match_date && match.home_team && match.away_team
      ? JSON.stringify([match.match_date.slice(0, 10), normalize(match.league_name), normalize(match.flight), normalize(match.home_team), normalize(match.away_team)])
      : match.id
    const existing = groups.get(key)
    if (!existing || match.id === selectedId || (existing.id !== selectedId && !existing.winner_side && match.winner_side)) groups.set(key, match)
  }
  return [...groups.values()]
}

export function orderCaptainMatchOptions<T extends MatchOption>(matches: T[], today: string) {
  return [...matches].sort((left, right) => {
    const leftDate = left.match_date?.slice(0, 10) || ''
    const rightDate = right.match_date?.slice(0, 10) || ''
    const leftUpcoming = Boolean(leftDate && leftDate >= today)
    const rightUpcoming = Boolean(rightDate && rightDate >= today)
    if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1
    if (!leftDate || !rightDate) return leftDate ? -1 : rightDate ? 1 : 0
    return leftUpcoming ? leftDate.localeCompare(rightDate) : rightDate.localeCompare(leftDate)
  })
}
