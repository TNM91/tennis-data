import { compactAvailabilityToken, expandAvailabilityToken } from './availability-short-links'

export type PracticeResponseStatus = 'in' | 'out' | 'maybe' | 'unanswered'
export type PracticeDisplayStatus = PracticeResponseStatus | 'waitlist'

export type PracticeInvitee = {
  id: string
  playerName: string
  responseStatus: PracticeResponseStatus
  respondedAt: string
  displayStatus: PracticeDisplayStatus
}

export function normalizePracticeName(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 160)
    : ''
}

export function practiceRsvpPath(token: string) {
  const code = compactAvailabilityToken(token)
  return code ? `/pr/${code}` : `/practice/${encodeURIComponent(token)}`
}

export function resolvePracticeToken(value: string) {
  const cleaned = value.trim()
  return expandAvailabilityToken(cleaned)
    || (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleaned) ? cleaned : '')
}

export function assignPracticeDisplayStatuses<T extends {
  responseStatus: PracticeResponseStatus
  respondedAt: string
}>(rows: T[], capacity: number | null) {
  const confirmed = rows
    .filter((row) => row.responseStatus === 'in')
    .sort((a, b) => {
      const timeDifference = Date.parse(a.respondedAt || '') - Date.parse(b.respondedAt || '')
      return Number.isFinite(timeDifference) && timeDifference !== 0 ? timeDifference : 0
    })
  const confirmedIds = new Set(
    (capacity ? confirmed.slice(0, capacity) : confirmed).map((row) => row),
  )

  return rows.map((row) => ({
    ...row,
    displayStatus: row.responseStatus === 'in' && !confirmedIds.has(row) ? 'waitlist' as const : row.responseStatus,
  }))
}

export function buildPracticeGoogleCalendarHref(input: {
  teamName: string
  scheduledDate: string
  scheduledTime: string
  facility: string
  notes?: string
}) {
  const range = buildPracticeCalendarRange(input.scheduledDate, input.scheduledTime)
  if (!range) return ''
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${input.teamName || 'Team'} practice`,
    dates: `${range.start}/${range.end}`,
    location: input.facility.trim(),
    details: input.notes?.trim() || 'Team practice coordinated in TenAceIQ.',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function buildPracticeIcs(input: {
  uid: string
  teamName: string
  scheduledDate: string
  scheduledTime: string
  facility: string
  notes?: string
}) {
  const range = buildPracticeCalendarRange(input.scheduledDate, input.scheduledTime)
  if (!range) return ''
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TenAceIQ//Team Practice//EN',
    'BEGIN:VEVENT',
    `UID:${escapeIcs(input.uid)}@tenaceiq.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${range.start}`,
    `DTEND:${range.end}`,
    `SUMMARY:${escapeIcs(`${input.teamName || 'Team'} practice`)}`,
    `LOCATION:${escapeIcs(input.facility)}`,
    `DESCRIPTION:${escapeIcs(input.notes?.trim() || 'Team practice coordinated in TenAceIQ.')}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

function buildPracticeCalendarRange(dateValue: string, timeValue: string) {
  const date = dateValue.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const time = timeValue.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!date || !time) return null
  const hour = Number(time[1])
  const minute = Number(time[2])
  if (hour > 23 || minute > 59) return null
  const dateStamp = `${date[1]}${date[2]}${date[3]}`
  const startMinutes = hour * 60 + minute
  const endMinutes = Math.min(startMinutes + 90, (24 * 60) - 1)
  const stamp = (minutes: number) => `${dateStamp}T${String(Math.floor(minutes / 60)).padStart(2, '0')}${String(minutes % 60).padStart(2, '0')}00`
  return { start: stamp(startMinutes), end: stamp(endMinutes) }
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}
