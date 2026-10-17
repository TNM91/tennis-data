type ScheduledMatch = { id: string; match_date: string | null; match_time?: string | null }

export function chooseAvailabilityMatch<T extends ScheduledMatch>(matches: T[], context: {
  selectedId: string
  date: string
  opponent: string
  today: string
  getOpponent: (match: T) => string
}): T | null {
  const ordered = [...matches].sort((a, b) =>
    (a.match_date || '9999').localeCompare(b.match_date || '9999')
    || (a.match_time || '').localeCompare(b.match_time || '') || a.id.localeCompare(b.id))
  const selected = ordered.find((match) => match.id === context.selectedId)
  if (selected) return selected
  if (context.date || context.opponent) {
    return ordered.find((match) => (!context.date || match.match_date === context.date)
      && (!context.opponent || context.getOpponent(match) === context.opponent)) ?? null
  }
  return ordered.find((match) => match.match_date && match.match_date >= context.today) ?? ordered[0] ?? null
}
