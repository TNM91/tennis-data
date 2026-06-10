export type PlayerCalendarKind = 'practice' | 'match' | 'lesson' | 'reminder' | 'availability'
export type PlayerAvailabilityStatus = '' | 'available' | 'unavailable'
export type PlayerCalendarRecurrenceRule = '' | 'FREQ=DAILY' | 'FREQ=WEEKLY' | 'FREQ=MONTHLY'

export type PlayerCalendarItem = {
  id: string
  title: string
  date: string
  time: string
  location: string
  kind: PlayerCalendarKind
  recurrenceRule: PlayerCalendarRecurrenceRule
  availabilityStatus: PlayerAvailabilityStatus
  createdAt: string
  updatedAt: string
}

export type PlayerCalendarItemRow = {
  id: string
  player_user_id: string
  title: string
  scheduled_date: string
  scheduled_time: string | null
  location?: string | null
  kind: string
  recurrence_rule?: string | null
  availability_status?: string | null
  created_at: string
  updated_at: string
}

export type PlayerCalendarItemInput = {
  id?: unknown
  title?: unknown
  date?: unknown
  time?: unknown
  location?: unknown
  kind?: unknown
  recurrenceRule?: unknown
  recurrence_rule?: unknown
  availabilityStatus?: unknown
  availability_status?: unknown
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizePlayerCalendarKind(value: unknown): PlayerCalendarKind {
  return value === 'practice' || value === 'match' || value === 'lesson' || value === 'reminder' || value === 'availability'
    ? value
    : 'reminder'
}

export function normalizePlayerCalendarRecurrenceRule(value: unknown): PlayerCalendarRecurrenceRule {
  const cleaned = cleanText(value).toUpperCase()
  if (cleaned === 'DAILY') return 'FREQ=DAILY'
  if (cleaned === 'WEEKLY') return 'FREQ=WEEKLY'
  if (cleaned === 'MONTHLY') return 'FREQ=MONTHLY'
  return cleaned === 'FREQ=DAILY' || cleaned === 'FREQ=WEEKLY' || cleaned === 'FREQ=MONTHLY' ? cleaned : ''
}

export function normalizePlayerAvailabilityStatus(value: unknown): PlayerAvailabilityStatus {
  return value === 'available' || value === 'unavailable' ? value : ''
}

export function mapPlayerCalendarItemRow(row: PlayerCalendarItemRow): PlayerCalendarItem {
  return {
    id: row.id,
    title: row.title,
    date: row.scheduled_date,
    time: row.scheduled_time ?? '',
    location: cleanText(row.location),
    kind: normalizePlayerCalendarKind(row.kind),
    recurrenceRule: normalizePlayerCalendarRecurrenceRule(row.recurrence_rule),
    availabilityStatus: normalizePlayerAvailabilityStatus(row.availability_status),
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
  const location = cleanText(input.location).slice(0, 160)
  const kind = normalizePlayerCalendarKind(input.kind)
  const availabilityStatus = kind === 'availability'
    ? normalizePlayerAvailabilityStatus(input.availabilityStatus ?? input.availability_status) || 'available'
    : ''

  return {
    id: cleanText(input.id) || `player-calendar-${crypto.randomUUID()}`,
    player_user_id: playerUserId,
    title,
    scheduled_date: date,
    scheduled_time: time,
    location,
    kind,
    recurrence_rule: normalizePlayerCalendarRecurrenceRule(input.recurrenceRule ?? input.recurrence_rule),
    availability_status: availabilityStatus,
    updated_at: now,
  }
}
