// Calendar dates must survive a round trip: JavaScript otherwise rolls dates
// such as February 30 into March instead of rejecting them.
export function isValidCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function formatCalendarDay(value: string, includeYear = true) {
  if (!isValidCalendarDate(value)) return 'Date to be confirmed'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: includeYear ? 'numeric' : undefined,
  }).format(new Date(`${value}T12:00:00Z`))
}

// Match offsets on either side of the date to handle daylight saving transitions.
export function eventCalendarStart(date: string, time: string, zone: string): Date | null {
  if (!isValidCalendarDate(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) || !zone) return null
  const wall = Date.parse(`${date}T${time}:00Z`)
  try {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    const partsAt = (stamp: number) => {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(stamp)).map(part => [part.type, part.value]))
      return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
    }
    const offsets = new Set([-36, 0, 36].map(hours => {
      const sample = wall + hours * 3600000
      return Date.parse(`${partsAt(sample)}Z`) - sample
    }))
    const candidates = [...offsets].map(offset => wall - offset)
      .filter(stamp => partsAt(stamp) === `${date}T${time}:00`).sort((a, b) => a - b)
    return candidates.length ? new Date(candidates[0]) : null
  } catch { return null }
}
