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

type LeagueResultEvent = {
  id: string
  event_type: string
  entity_name: string
  body: string | null
}

type VisibleMatchResult = {
  league_name: string | null
  home_team: string | null
  away_team: string | null
  score: string | null
  match_date: string | null
}

export function overlappingLeagueResultIds(events: LeagueResultEvent[], matches: VisibleMatchResult[]): Set<string> {
  const normalize = (value: string | null) => (value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
  const ids = new Set<string>()

  for (const event of events) {
    if (event.event_type !== 'league_result_posted' || !event.body) continue
    const result = /^(.+?) vs (.+?) • (\d+-\d+) lines(?: on (\d{4}-\d{2}-\d{2}))?$/.exec(event.body)
    if (!result) continue

    const candidates = matches.filter((match) =>
      normalize(match.league_name) === normalize(event.entity_name) &&
      normalize(match.home_team) === normalize(result[1]) &&
      normalize(match.away_team) === normalize(result[2]) &&
      normalize(match.score) === normalize(result[3]) &&
      (!result[4] || match.match_date?.slice(0, 10) === result[4]),
    )

    // Older events have no match date; only collapse them when the match is unambiguous.
    if (result[4] ? candidates.length > 0 : candidates.length === 1) ids.add(event.id)
  }

  return ids
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
