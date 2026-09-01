type CalendarLinkInput = {
  eventDate: string
  eventTime: string
  opponent: string
  location: string
  details?: string
}

export function buildMatchWeekGoogleCalendarHref(input: CalendarLinkInput) {
  const date = parseDate(input.eventDate)
  const startMinutes = parseTime(input.eventTime)
  if (!date || startMinutes === null) return ''

  const start = calendarStamp(date, startMinutes)
  const end = calendarStamp(date, Math.min(startMinutes + 180, (24 * 60) - 1))
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `TenAceIQ match vs ${input.opponent || 'Opponent'}`,
    dates: `${start}/${end}`,
    location: input.location.trim(),
    details: input.details?.trim() || '',
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function buildMatchWeekMapsHref(location: string) {
  const query = location.trim()
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : ''
}

export function buildMatchWeekPhoneCalendarHref(requestUrl: string) {
  try {
    const url = new URL(requestUrl)
    const token = url.pathname.split('/').filter(Boolean).pop()
    if (!token) return ''
    return `${url.origin}/api/captain/availability-requests/${encodeURIComponent(token)}/calendar.ics`
  } catch {
    return ''
  }
}

export function buildMatchWeekIcs(input: CalendarLinkInput & { uid: string }) {
  const date = parseDate(input.eventDate)
  const startMinutes = parseTime(input.eventTime)
  if (!date || startMinutes === null) return ''

  const title = escapeIcsText(`TenAceIQ match vs ${input.opponent || 'Opponent'}`)
  const description = escapeIcsText(input.details?.trim() || 'TenAceIQ match')
  const location = escapeIcsText(input.location.trim())
  const start = calendarStamp(date, startMinutes)
  const end = calendarStamp(date, Math.min(startMinutes + 180, (24 * 60) - 1))
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TenAceIQ//Match Week//EN',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(input.uid)}@tenaceiq.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${title}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

function parseDate(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const [year, month, day] = match.slice(1).map(Number)
  if (!year || !month || !day) return null
  return { year, month, day }
}

function parseTime(value: string) {
  const match = value.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(a|p|am|pm)?$/)
  if (!match) return null
  let hour = Number(match[1])
  const minute = Number(match[2] || 0)
  const marker = match[3] || ''
  if (minute > 59 || hour > 23) return null
  if (marker.startsWith('p') && hour < 12) hour += 12
  if (marker.startsWith('a') && hour === 12) hour = 0
  return (hour * 60) + minute
}

function calendarStamp(date: { year: number; month: number; day: number }, minutes: number) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.year}${pad(date.month)}${pad(date.day)}T${pad(Math.floor(minutes / 60))}${pad(minutes % 60)}00`
}

function escapeIcsText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}
