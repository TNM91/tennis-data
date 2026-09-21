export function sortWatchlistFeed<T extends { createdAt: string | null; score: number }>(items: T[]): T[] {
  const eventTime = (value: string | null) => {
    const parsed = value ? Date.parse(value) : NaN
    return Number.isFinite(parsed) ? parsed : null
  }

  return [...items].sort((a, b) => {
    const aTime = eventTime(a.createdAt)
    const bTime = eventTime(b.createdAt)
    if (aTime !== null && bTime !== null) return bTime - aTime || b.score - a.score
    if (aTime !== null) return -1
    if (bTime !== null) return 1
    return b.score - a.score
  })
}
