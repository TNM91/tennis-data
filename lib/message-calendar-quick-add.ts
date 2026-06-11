export type CalendarQuickAddCandidate = {
  title: string
  date: string
  time: string
  location: string
  kind: 'reminder' | 'availability'
  availabilityStatus: '' | 'available' | 'unavailable'
  sourceLabel: string
}

const maxCalendarItemIdLength = 96

type DateMatchResult = {
  year: number
  month: number
  day: number
  index: number
  endIndex: number
}

type TimeMatchResult = {
  value: string
  endIndex: number
}

const monthNames: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

function pad2(value: number) {
  return value.toString().padStart(2, '0')
}

function slugifyCalendarIdPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function hashCalendarQuickAddValue(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash, 31) + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

function isValidDate(year: number, month: number, day: number) {
  const parsed = new Date(year, month - 1, day)
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
}

function findDateMatch(text: string): DateMatchResult | null {
  const isoMatch = /\b(20\d{2})-(\d{2})-(\d{2})\b/.exec(text)
  if (isoMatch?.index !== undefined) {
    return buildDateMatch(isoMatch, Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]))
  }

  const slashMatch = /\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(20\d{2})\b/.exec(text)
  if (slashMatch?.index !== undefined) {
    return buildDateMatch(slashMatch, Number(slashMatch[3]), Number(slashMatch[1]), Number(slashMatch[2]))
  }

  const monthMatch = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+([0-2]?\d|3[01]),?\s+(20\d{2})\b/i.exec(text)
  if (monthMatch?.index !== undefined) {
    const month = monthNames[monthMatch[1].toLowerCase().replace(/\.$/, '')] ?? 0
    return buildDateMatch(monthMatch, Number(monthMatch[3]), month, Number(monthMatch[2]))
  }

  return null
}

function buildDateMatch(match: RegExpExecArray, year: number, month: number, day: number): DateMatchResult | null {
  if (!isValidDate(year, month, day)) return null
  return {
    year,
    month,
    day,
    index: match.index,
    endIndex: match.index + match[0].length,
  }
}

function normalizeHour(hour: number, meridiem: string) {
  const normalizedMeridiem = meridiem.toLowerCase()
  if (normalizedMeridiem === 'pm' && hour < 12) return hour + 12
  if (normalizedMeridiem === 'am' && hour === 12) return 0
  return hour
}

function findTimeMatch(text: string): TimeMatchResult {
  const withAt = /\bat\s+([01]?\d|2[0-3])(?::([0-5]\d))?\s*(am|pm)?\b/i.exec(text)
  if (withAt?.index !== undefined) {
    const hour = normalizeHour(Number(withAt[1]), withAt[3] || '')
    const minute = Number(withAt[2] || '0')
    return {
      value: `${pad2(hour)}:${pad2(minute)}`,
      endIndex: withAt.index + withAt[0].length,
    }
  }

  const withColon = /(?:^|\s)(([01]?\d|2[0-3]):([0-5]\d))\b/.exec(text)
  if (withColon?.index !== undefined) {
    return {
      value: `${pad2(Number(withColon[2]))}:${withColon[3]}`,
      endIndex: withColon.index + withColon[0].length,
    }
  }

  const withMeridiem = /(?:^|\s)(1[0-2]|0?[1-9])\s*(am|pm)\b/i.exec(text)
  if (withMeridiem?.index !== undefined) {
    return {
      value: `${pad2(normalizeHour(Number(withMeridiem[1]), withMeridiem[2]))}:00`,
      endIndex: withMeridiem.index + withMeridiem[0].length,
    }
  }

  return { value: '', endIndex: 0 }
}

function inferAvailabilityStatus(value: string): CalendarQuickAddCandidate['availabilityStatus'] {
  const normalized = value.toLowerCase()
  if (/\b(unavailable|not available|can't|cannot|out|busy|away)\b/.test(normalized)) return 'unavailable'
  if (/\b(available|free|open)\b/.test(normalized)) return 'available'
  return ''
}

export function detectCalendarQuickAddCandidate(
  text: string,
  fallbackTitle: string,
  sourceLabel: string,
): CalendarQuickAddCandidate | null {
  const cleaned = text.trim().replace(/\s+/g, ' ')
  if (!cleaned) return null

  const dateMatch = findDateMatch(cleaned)
  if (!dateMatch) return null

  const beforeDate = cleaned.slice(0, dateMatch.index).replace(/\b(on|for|at)\s*$/i, '').trim()
  const afterDate = cleaned.slice(dateMatch.endIndex)
  const timeMatch = findTimeMatch(afterDate)
  const locationSource = afterDate.slice(timeMatch.endIndex)
  const locationMatch = locationSource.match(/(?:\bat\s+|@\s*)([A-Za-z0-9 .,#'&-]{3,80})/)
  const title = beforeDate && beforeDate.length >= 4 ? beforeDate.slice(0, 90) : fallbackTitle || 'Message calendar item'
  const availabilityStatus = inferAvailabilityStatus(beforeDate)

  return {
    title,
    date: `${dateMatch.year}-${pad2(dateMatch.month)}-${pad2(dateMatch.day)}`,
    time: timeMatch.value,
    location: locationMatch?.[1]?.trim().replace(/[.!?]$/, '').slice(0, 80) || '',
    kind: availabilityStatus ? 'availability' : 'reminder',
    availabilityStatus,
    sourceLabel,
  }
}

export function buildCalendarQuickAddItemId(candidate: CalendarQuickAddCandidate, scope: string) {
  const raw = [
    scope,
    candidate.title,
    candidate.date,
    candidate.time,
    candidate.location,
    candidate.kind,
    candidate.availabilityStatus,
  ].join('|')
  const scopeSlug = slugifyCalendarIdPart(scope) || 'message'
  const titleSlug = slugifyCalendarIdPart(candidate.title).slice(0, 32) || 'calendar-item'
  const dateSlug = slugifyCalendarIdPart([candidate.date, candidate.time].filter(Boolean).join('-')) || 'date'
  const hash = hashCalendarQuickAddValue(raw)

  return `message-calendar-${scopeSlug}-${dateSlug}-${titleSlug}-${hash}`.slice(0, maxCalendarItemIdLength)
}
