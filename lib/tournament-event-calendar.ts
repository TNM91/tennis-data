import type { TiqTournamentRecord } from './tiq-tournament-registry'
import { buildTournamentEventPass } from './tournament-event-pass'
import { escapeIcsText, foldIcsLine } from './tiq-league-schedule-calendar'
import { eventCalendarStart } from './calendar-date'
import { tournamentCourtLabel } from './tournament-event-presentation'

export { eventCalendarStart } from './calendar-date'

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
  const location = [event.eventDetails?.venueName || event.locationLabel, event.eventDetails?.venueAddress, tournamentCourtLabel(match.court)].filter(Boolean).join(' · ')
  const description = [`${division.name} · ${match.label}`, `${match.sideA} vs ${match.sideB}`, `Event time zone: ${event.eventDetails?.timeZone}`, 'Start-time reminder. Match length may vary.', 'This is a saved snapshot. Schedule changes do not sync automatically. Refresh your event pass before heading to court.', url].join('\n')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TenAceIQ//Tournament Event Pass//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:event-${encodeURIComponent(event.id)}-${encodeURIComponent(division.id)}-${encodeURIComponent(match.matchId)}@tenaceiq.com`,
    `DTSTAMP:${stamp(now)}`, `LAST-MODIFIED:${stamp(modified)}`, `DTSTART:${stamp(start)}`,
    `SUMMARY:${escapeIcsText(`${event.name} · ${match.sideA} vs ${match.sideB}`)}`, `LOCATION:${escapeIcsText(location)}`,
    `DESCRIPTION:${escapeIcsText(description)}`, `URL:${url}`, 'END:VEVENT', 'END:VCALENDAR']
  return { content: `${lines.map(foldIcsLine).join('\r\n')}\r\n`, filename: 'TenAceIQ-next-match.ics' }
}
