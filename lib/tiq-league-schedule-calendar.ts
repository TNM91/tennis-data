import type { TiqLeagueScheduleItem } from '@/lib/tiq-league-schedule-service'

export type ScheduleCalendarDay = {
  date: string
  label: string
  dayLabel: string
  items: TiqLeagueScheduleItem[]
}

export type ScheduleCalendarFeedOptions = {
  calendarName?: string
  productUrl?: string
  timeZone?: string
  durationMinutes?: number
}

export type TennisCalendarEvent = {
  id: string
  title: string
  date: string
  time?: string
  location?: string
  description?: string
  url?: string
  durationMinutes?: number
  recurrenceRule?: string
}

function formatScheduleDateLabel(value: string) {
  const parsed = value ? new Date(`${value}T12:00:00`) : null
  if (!parsed || Number.isNaN(parsed.getTime())) return value || 'Date TBD'

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function formatScheduleDayLabel(value: string) {
  const parsed = value ? new Date(`${value}T12:00:00`) : null
  if (!parsed || Number.isNaN(parsed.getTime())) return 'TBD'

  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
  })
}

export function buildScheduleCalendarDays(items: TiqLeagueScheduleItem[]): ScheduleCalendarDay[] {
  const days = new Map<string, TiqLeagueScheduleItem[]>()

  for (const item of items) {
    const dateKey = item.scheduledDate || 'unscheduled'
    days.set(dateKey, [...(days.get(dateKey) || []), item])
  }

  return Array.from(days.entries())
    .sort(([leftDate], [rightDate]) => {
      const leftKey = leftDate === 'unscheduled' ? '9999-12-31' : leftDate
      const rightKey = rightDate === 'unscheduled' ? '9999-12-31' : rightDate
      return leftKey.localeCompare(rightKey)
    })
    .map(([date, dayItems]) => ({
      date,
      label: date === 'unscheduled' ? 'Date TBD' : formatScheduleDateLabel(date),
      dayLabel: date === 'unscheduled' ? 'TBD' : formatScheduleDayLabel(date),
      items: dayItems,
    }))
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function formatIcsDate(value: string) {
  return value.replace(/-/g, '')
}

function parseTimeParts(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

function addDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().slice(0, 10)
}

function addMinutes(date: string, time: string, minutes: number) {
  const parts = parseTimeParts(time)
  if (!parts) return { date, time }

  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return { date, time }

  const totalMinutes = parts.hour * 60 + parts.minute + minutes
  const dayOffset = Math.floor(totalMinutes / 1440)
  const minuteOfDay = ((totalMinutes % 1440) + 1440) % 1440
  parsed.setUTCDate(parsed.getUTCDate() + dayOffset)

  const hour = Math.floor(minuteOfDay / 60).toString().padStart(2, '0')
  const minute = (minuteOfDay % 60).toString().padStart(2, '0')
  return {
    date: parsed.toISOString().slice(0, 10),
    time: `${hour}:${minute}`,
  }
}

function buildIcsDateLines(date: string, time: string, timeZone: string, durationMinutes: number) {
  const normalizedDate = formatIcsDate(date)
  const parsedTime = parseTimeParts(time)
  if (!parsedTime) {
    return [
      `DTSTART;VALUE=DATE:${normalizedDate}`,
      `DTEND;VALUE=DATE:${formatIcsDate(addDays(date, 1))}`,
    ]
  }

  const startTime = `${parsedTime.hour.toString().padStart(2, '0')}${parsedTime.minute.toString().padStart(2, '0')}00`
  const end = addMinutes(date, time, durationMinutes)
  const endParts = parseTimeParts(end.time) ?? parsedTime
  const endTime = `${endParts.hour.toString().padStart(2, '0')}${endParts.minute.toString().padStart(2, '0')}00`

  return [
    `DTSTART;TZID=${timeZone}:${normalizedDate}T${startTime}`,
    `DTEND;TZID=${timeZone}:${formatIcsDate(end.date)}T${endTime}`,
  ]
}

function sanitizeIcsRule(value: string | undefined) {
  const cleaned = (value || '').trim().toUpperCase()
  return /^FREQ=(DAILY|WEEKLY|MONTHLY)(;[A-Z0-9_-]+=[A-Z0-9_,+-]+)*$/.test(cleaned) ? cleaned : ''
}

export function buildScheduleCalendarFeed(
  items: TiqLeagueScheduleItem[],
  options: ScheduleCalendarFeedOptions = {},
) {
  const events: TennisCalendarEvent[] = items
    .filter((item) => item.scheduledDate && item.status !== 'cancelled')
    .map((item) => ({
      id: item.id,
      title: `${item.participantAName || 'Player A'} vs ${item.participantBName || 'Player B'}`,
      date: item.scheduledDate,
      time: item.scheduledTime,
      location: item.facility,
      description: [
        item.leagueFormat === 'team' ? 'Team league match' : 'Individual league match',
        item.notes,
        `Status: ${item.status}`,
      ].filter(Boolean).join('\n'),
      url: options.productUrl,
    }))

  return buildTennisCalendarFeed(events, options)
}

export function buildTennisCalendarFeed(
  events: TennisCalendarEvent[],
  options: ScheduleCalendarFeedOptions = {},
) {
  const calendarName = options.calendarName || 'TenAceIQ schedule'
  const productUrl = options.productUrl || 'https://tenaceiq.com'
  const timeZone = options.timeZone || 'America/Chicago'
  const durationMinutes = options.durationMinutes ?? 90
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TenAceIQ//League Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    `X-WR-TIMEZONE:${escapeIcsText(timeZone)}`,
  ]

  for (const event of events) {
    if (!event.id || !event.date) continue
    const recurrenceRule = sanitizeIcsRule(event.recurrenceRule)

    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeIcsText(event.id)}@tenaceiq.com`,
      `SUMMARY:${escapeIcsText(event.title || 'TenAceIQ calendar item')}`,
      `DESCRIPTION:${escapeIcsText(event.description || '')}`,
      `LOCATION:${escapeIcsText(event.location || '')}`,
      `URL:${escapeIcsText(event.url || productUrl)}`,
      ...buildIcsDateLines(event.date, event.time || '', timeZone, event.durationMinutes ?? durationMinutes),
      ...(recurrenceRule ? [`RRULE:${recurrenceRule}`] : []),
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}
