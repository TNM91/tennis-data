export type TeamRoomLineupRow = {
  label: string
  players: string[]
}

export type TeamRoomMatchCardState = 'active' | 'upcoming' | 'archived'

export type TeamRoomCardCandidate = {
  id: string
  createdAt: string
  matchDate: string
}

export type TeamRoomReminderTarget = {
  profileId: string
  needsResponse: boolean
  needsMaybeFollowup: boolean
  needsAckVersion: number
}

export function normalizeLineupRows(value: unknown): TeamRoomLineupRow[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 12).map((entry) => {
    const row = entry && typeof entry === 'object' && !Array.isArray(entry)
      ? entry as Record<string, unknown>
      : {}
    return {
      label: cleanText(row.label).slice(0, 80),
      players: (Array.isArray(row.players) ? row.players : [])
        .map((player) => cleanText(player).slice(0, 120))
        .filter(Boolean)
        .slice(0, 4),
    }
  }).filter((row) => row.label || row.players.length)
}

export function buildLineupChanges(previous: TeamRoomLineupRow[], next: TeamRoomLineupRow[]) {
  const previousByCourt = new Map(previous.map((row, index) => [lineupRowKey(row, index), row]))
  const nextByCourt = new Map(next.map((row, index) => [lineupRowKey(row, index), row]))
  const keys = Array.from(new Set([...previousByCourt.keys(), ...nextByCourt.keys()]))

  return keys.flatMap((key) => {
    const before = previousByCourt.get(key)
    const after = nextByCourt.get(key)
    if (before && after && samePlayers(before.players, after.players)) return []
    const label = after?.label || before?.label || 'Court'
    const beforePlayers = before?.players.join(' / ') || 'Open'
    const afterPlayers = after?.players.join(' / ') || 'Open'
    return [`${label}: ${beforePlayers} -> ${afterPlayers}`]
  })
}

export function selectActiveTeamRoomCard(cards: TeamRoomCardCandidate[], today = todayDateKey()) {
  const future = cards
    .filter((card) => card.matchDate && card.matchDate >= today)
    .sort((left, right) => {
      const dateCompare = left.matchDate.localeCompare(right.matchDate)
      if (dateCompare) return dateCompare
      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
    })
  return future[0]?.id || ''
}

export function teamRoomCardState(
  card: TeamRoomCardCandidate,
  activeCardId: string,
  today = todayDateKey(),
): TeamRoomMatchCardState {
  if (card.id === activeCardId) return 'active'
  return card.matchDate && card.matchDate < today ? 'archived' : 'upcoming'
}

export function parseReminderTargets(value: unknown): TeamRoomReminderTarget[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const row = entry as Record<string, unknown>
    const profileId = cleanText(row.profileId)
    if (!profileId || seen.has(profileId)) return []
    seen.add(profileId)
    return [{
      profileId,
      needsResponse: row.needsResponse === true,
      needsMaybeFollowup: row.needsMaybeFollowup === true,
      needsAckVersion: Math.max(0, Math.floor(Number(row.needsAckVersion) || 0)),
    }]
  })
}

export function todayDateKey(now = new Date(), timeZone = process.env.TENACEIQ_TIME_ZONE || 'America/Chicago') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const year = parts.find((part) => part.type === 'year')?.value || String(now.getUTCFullYear())
  const month = parts.find((part) => part.type === 'month')?.value || String(now.getUTCMonth() + 1).padStart(2, '0')
  const day = parts.find((part) => part.type === 'day')?.value || String(now.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function lineupRowKey(row: TeamRoomLineupRow, index: number) {
  return cleanText(row.label).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() || `court-${index}`
}

function samePlayers(left: string[], right: string[]) {
  if (left.length !== right.length) return false
  return left.every((player, index) => normalizeName(player) === normalizeName(right[index]))
}

function normalizeName(value: string) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
