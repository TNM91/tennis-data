export function getTeamActivityGroup(match: { won: boolean | null; match_date: string | null }, today: string) {
  if (match.won !== null) return 'results'
  const date = match.match_date?.slice(0, 10)
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today ? 'upcoming' : 'unreported'
}
