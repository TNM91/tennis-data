export type TeamDirectoryDates = {
  mostRecentMatchDate: string | null
  nextScheduledMatchDate: string | null
}

export function getTeamDirectoryMatchDates(match: { match_date: string | null; winner_side: string | null; status?: string | null }, today: string) {
  const day = match.match_date?.slice(0, 10) || ''
  const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(day) ? Date.parse(`${day}T12:00:00Z`) : NaN
  const date = Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === day ? day : null
  const cancelled = ['canceled', 'cancelled', 'postponed', 'void', 'abandoned'].includes(match.status?.trim().toLowerCase() || '')
  const result = !cancelled && (match.winner_side === 'A' || match.winner_side === 'B') && (!date || date <= today)
  return {
    result,
    mostRecentMatchDate: result ? date : null,
    nextScheduledMatchDate: !cancelled && !match.winner_side && date && date >= today ? date : null,
  }
}

export function mergeTeamDirectoryDates(left: TeamDirectoryDates, right: TeamDirectoryDates): TeamDirectoryDates {
  const results = [left.mostRecentMatchDate, right.mostRecentMatchDate].filter((date): date is string => Boolean(date)).sort()
  const schedule = [left.nextScheduledMatchDate, right.nextScheduledMatchDate].filter((date): date is string => Boolean(date)).sort()
  return { mostRecentMatchDate: results.at(-1) || null, nextScheduledMatchDate: schedule[0] || null }
}
