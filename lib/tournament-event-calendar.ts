import type { TiqTournamentRecord } from './tiq-tournament-registry'
import { buildTournamentEventPass } from './tournament-event-pass'
import { escapeIcsText, foldIcsLine } from './tiq-league-schedule-calendar'

// Resolve the event's wall time using its configured zone, never the player's device zone.
// Matching candidate offsets also handles DST transitions and rejects nonexistent times.
export function eventCalendarStart(date: string, time: string, zone: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) || !zone) return null
  const wall = new Date(`${date}T${time}:00Z`)
  if (!Number.isFinite(wall.getTime()) || wall.toISOString().slice(0, 10) !== date) return null
  try {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    const partsAt = (stamp: number) => {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(stamp)).map(part => [part.type, part.value]))
      return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
    }
    const offsets = new Set([-36, 0, 36].map(hours => {
      const sample = wall.getTime() + hours * 3600000
      return Date.parse(`${partsAt(sample)}Z`) - sample
    }))
    const candidates = [...offsets].map(offset => wall.getTime() - offset)
      .filter(stamp => partsAt(stamp) === `${date}T${time}:00`).sort((a, b) => a - b)
    return candidates.length ? new Date(candidates[0]) : null
  } catch { return null }
}

function stamp(date: Date) { return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') }

export function buildTournamentNextMatchCalendar(event: TiqTournamentRecord, division: TiqTournamentRecord, entrant: string, now = new Date()) {
  if (division.eventId !== event.id || event.status === 'completed' || division.status === 'completed') return null
  const pass = buildTournamentEventPass(division, entrant)
  const match = pass?.next
  if (!match || !match.assigned || match.ready === false || !division.entrants.includes(match.sideA) || !division.entrants.includes(match.sideB)) return null
  const start = eventCalendarStart(match.date, match.time, event.eventDetails?.timeZone || '')
  if (!start) return null
  const saved = new Date(division.schedule[match.matchId]?.updatedAt || '')
  const modified = Number.isFinite(saved.getTime()) ? saved : now
  const url = `https://www.tenaceiq.com/tournaments/${encodeURIComponent(event.id)}#event-pass`
  const location = [event.eventDetails?.venueName || event.locationLabel, event.eventDetails?.venueAddress, /^court\b/i.test(match.court) ? match.court : `Court ${match.court}`].filter(Boolean).join(' · ')
  const description = [`${division.name} · ${match.label}`, `${match.sideA} vs ${match.sideB}`, `Event time zone: ${event.eventDetails?.timeZone}`, 'Start-time reminder. Match length may vary.', 'This is a saved snapshot. Schedule changes do not sync automatically. Refresh your event pass before heading to court.', url].join('\n')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TenAceIQ//Tournament Event Pass//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:event-${encodeURIComponent(event.id)}-${encodeURIComponent(division.id)}-${encodeURIComponent(match.matchId)}@tenaceiq.com`,
    `DTSTAMP:${stamp(now)}`, `LAST-MODIFIED:${stamp(modified)}`, `DTSTART:${stamp(start)}`,
    `SUMMARY:${escapeIcsText(`${event.name} · ${match.sideA} vs ${match.sideB}`)}`, `LOCATION:${escapeIcsText(location)}`,
    `DESCRIPTION:${escapeIcsText(description)}`, `URL:${url}`, 'END:VEVENT', 'END:VCALENDAR']
  return { content: `${lines.map(foldIcsLine).join('\r\n')}\r\n`, filename: 'TenAceIQ-next-match.ics' }
}
