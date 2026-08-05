export type TeamRoomMatchDayPhase = 'upcoming' | 'match_day' | 'post_match'

export function getTeamRoomMatchDayPhase(input: {
  matchDate: string
  localDateKey: string
  matchCompletedAt?: string | null
}): TeamRoomMatchDayPhase {
  if (cleanText(input.matchCompletedAt)) return 'post_match'
  const matchDate = cleanDateKey(input.matchDate)
  const localDateKey = cleanDateKey(input.localDateKey)
  if (!matchDate || !localDateKey || matchDate > localDateKey) return 'upcoming'
  return matchDate === localDateKey ? 'match_day' : 'post_match'
}

export function buildTeamRoomMapsHref(facility: string) {
  const query = cleanText(facility)
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : ''
}

function cleanDateKey(value: unknown) {
  const dateKey = cleanText(value).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : ''
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
