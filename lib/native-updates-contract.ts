import { isValidCalendarDate } from './calendar-date'

export type UpdateFilter = { unread: boolean; category: 'all' | 'message' | 'schedule' | 'other' }
export type UpdateCursor = { createdAt: string; id: string }
export const UPDATE_PAGE_SIZE = 25, UPDATE_LOADED_LIMIT = 100
export const updateCategories = ['all', 'message', 'schedule', 'other'] as const
export const updateId = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/
export const updateTimestamp = (value: unknown): value is string => typeof value === 'string' &&
  timestamp.test(value) && isValidCalendarDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value))

export function updateCursorFilter(cursor: UpdateCursor) {
  if (!updateId(cursor.id) || !updateTimestamp(cursor.createdAt)) throw Error('Refresh updates before loading more.')
  // Preserve PostgreSQL microseconds rather than rounding a cursor through Date.
  return 'created_at.lt.'+cursor.createdAt+',and(created_at.eq.'+cursor.createdAt+',id.lt.'+cursor.id+')'
}

export function validUpdateIds(ids: unknown): ids is string[] {
  return Array.isArray(ids) && ids.length > 0 && ids.length <= UPDATE_LOADED_LIMIT &&
    ids.every(updateId) && new Set(ids.map(id => id.toLowerCase())).size === ids.length
}

export function confirmUpdatesRead(value: unknown, owner: string, ids: readonly string[]) {
  const fault = () => Error('Read status was not confirmed. Refresh updates before trying again.')
  if (!Array.isArray(value) || value.length !== ids.length) throw fault()
  const remaining = new Set(ids)
  for (const row of value) {
    if (!row || !remaining.delete(row.id) || row.recipient_profile_id !== owner || !updateTimestamp(row.read_at)) throw fault()
  }
  return value as { id: string; recipient_profile_id: string; read_at: string }[]
}
