export type PlayerCalendarKind = 'practice' | 'match' | 'lesson' | 'reminder'

export type PlayerCalendarItem = {
  id: string
  title: string
  date: string
  time: string
  kind: PlayerCalendarKind
  createdAt: string
  updatedAt: string
}

export type PlayerCalendarItemRow = {
  id: string
  player_user_id: string
  title: string
  scheduled_date: string
  scheduled_time: string | null
  kind: string
  created_at: string
  updated_at: string
}

export type PlayerCalendarItemInput = {
  id?: unknown
  title?: unknown
  date?: unknown
  time?: unknown
  kind?: unknown
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizePlayerCalendarKind(value: unknown): PlayerCalendarKind {
  return value === 'practice' || value === 'match' || value === 'lesson' || value === 'reminder'
    ? value
    : 'reminder'
}

export function mapPlayerCalendarItemRow(row: PlayerCalendarItemRow): PlayerCalendarItem {
  return {
    id: row.id,
    title: row.title,
    date: row.scheduled_date,
    time: row.scheduled_time ?? '',
    kind: normalizePlayerCalendarKind(row.kind),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function buildPlayerCalendarItemPayload(input: PlayerCalendarItemInput, playerUserId: string) {
  const title = cleanText(input.title)
  const date = cleanText(input.date)
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null

  const rawTime = cleanText(input.time)
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(rawTime) ? rawTime : ''
  const now = new Date().toISOString()

  return {
    id: cleanText(input.id) || `player-calendar-${crypto.randomUUID()}`,
    player_user_id: playerUserId,
    title,
    scheduled_date: date,
    scheduled_time: time,
    kind: normalizePlayerCalendarKind(input.kind),
    updated_at: now,
  }
}
