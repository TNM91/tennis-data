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

export function dedupeLeagueResultFeed<T extends {
  event_type: string
  entity_type: string
  entity_id: string
  title: string
  body: string | null
  created_at: string
}>(rows: T[]): T[] {
  const seen = new Set<string>()
  return rows.filter((row) => {
    if (row.event_type !== 'league_result_posted') return true
    const key = JSON.stringify([row.event_type, row.entity_type, row.entity_id, row.title, row.body])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function hasWatchlistResult(score: string | null): boolean {
  return Boolean(score?.trim() && !/^pending$/i.test(score.trim()))
}

export function isUpcomingWatchlistMatch(matchDate: string | null, score: string | null, now = new Date()): boolean {
  if (!matchDate || hasWatchlistResult(score)) return false
  const matchDay = new Date(`${matchDate.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(matchDay.getTime())) return false
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return matchDay.getTime() >= today.getTime()
}

export function formatUpcomingWatchlistDate(matchDate: string | null): string {
  const parts = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/.exec(matchDate ?? '')
  if (!parts) return 'Date unavailable'
  const day = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), 12)
  return Number.isNaN(day.getTime()) ? 'Date unavailable' : day.toLocaleDateString()
}

export function sortUpcomingWatchlistFeed<T extends { createdAt: string | null; score: number }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftTime = left.createdAt ? Date.parse(left.createdAt) : Infinity
    const rightTime = right.createdAt ? Date.parse(right.createdAt) : Infinity
    return leftTime - rightTime || right.score - left.score
  })
}
