import { describe, expect, it } from 'vitest'
import { buildTournamentNextMatchCalendar, eventCalendarStart } from '../tournament-event-calendar'
import type { TiqTournamentRecord } from '../tiq-tournament-registry'
const event: TiqTournamentRecord = { id: 'pumpkin', isEvent: true, name: 'Pumpkin Playoffs', format: 'round_robin', entrantType: 'teams', status: 'draft', startsOn: '2026-10-17', locationLabel: 'Woodsmill', directorNotes: 'Private director note', entrants: [], results: {}, schedule: {}, contacts: {}, entrantPlayerIds: {}, isPublic: false, createdAt: '', updatedAt: '', eventDetails: { timeZone: 'America/Chicago', venueName: 'Woodsmill Tennis Club', venueAddress: '910 Old Woodsmill Road, Chesterfield, MO 63017' } }
const division: TiqTournamentRecord = { ...event, id: '40', eventId: 'pumpkin', isEvent: false, name: "Men's 4.0 Doubles", entrants: ['Morgan / Lee', 'Chris / Jamie'], schedule: { 'r1-m1': { date: '2026-10-17', time: '17:30', court: '2', updatedAt: '2026-10-08T12:00:00Z' } } }
const now = new Date('2026-10-08T13:00:00Z')
const unfold = (value: string) => value.replace(/\r\n /g, '')
describe('next-match calendar', () => {
  it('resolves the venue zone across summer, winter and DST transitions', () => {
    expect(eventCalendarStart('2026-10-17', '17:30', 'America/Chicago')?.toISOString()).toBe('2026-10-17T22:30:00.000Z')
    expect(eventCalendarStart('2026-12-17', '17:30', 'America/Chicago')?.toISOString()).toBe('2026-12-17T23:30:00.000Z')
    expect(eventCalendarStart('2026-03-08', '02:30', 'America/Chicago')).toBeNull()
    expect(eventCalendarStart('2026-11-01', '01:30', 'America/Chicago')?.toISOString()).toBe('2026-11-01T06:30:00.000Z')
    expect(eventCalendarStart('2026-10-17', '17:30', 'Asia/Kathmandu')?.toISOString()).toBe('2026-10-17T11:45:00.000Z')
  })
  it('rejects invalid dates, times and unconfigured zones', () => {
    expect(eventCalendarStart('2026-02-30', '17:30', 'UTC')).toBeNull()
    expect(eventCalendarStart('2026-10-17', '24:30', 'UTC')).toBeNull()
    expect(eventCalendarStart('2026-10-17', '17:30', '')).toBeNull()
    expect(eventCalendarStart('2026-10-17', '17:30', 'Unknown')).toBeNull()
  })
  it('exports only the selected entrant’s playable next match, with venue and snapshot guidance', () => {
    const calendar = buildTournamentNextMatchCalendar(event, division, 'Morgan / Lee', now)!
    const content = unfold(calendar.content)
    expect(content).toContain('DTSTART:20261017T223000Z')
    expect(content).toContain('Court 2')
    expect(content).toContain('Woodsmill Tennis Club')
    expect(content).toContain('910 Old Woodsmill Road')
    expect(content).toContain('Morgan / Lee vs Chris / Jamie')
    expect(content).toContain('https://www.tenaceiq.com/tournaments/pumpkin#event-pass')
    expect(content).toContain('Schedule changes do not sync automatically')
    expect(content).not.toContain('Private director note')
    expect(content).not.toContain('DTEND')
    expect(content.match(/BEGIN:VEVENT/g)).toHaveLength(1)
  })
  it('withholds downloads for unknown entrants, unresolved, unassigned, completed, or unrelated matches', () => {
    expect(buildTournamentNextMatchCalendar(event, division, 'Unknown', now)).toBeNull()
    const unresolved: TiqTournamentRecord = { ...division, format: 'single_elimination', entrants: ['Morgan / Lee', 'Chris / Jamie', 'Alex / Sam', 'Jordan / Taylor'], results: { 'r1-m1': { winner: 'Morgan / Lee', score: '6-4', updatedAt: '' } }, schedule: { 'r2-m1': division.schedule['r1-m1'] } }
    expect(buildTournamentNextMatchCalendar(event, unresolved, 'Morgan / Lee', now)).toBeNull()
    expect(buildTournamentNextMatchCalendar(event, { ...division, schedule: {} }, 'Morgan / Lee', now)).toBeNull()
    expect(buildTournamentNextMatchCalendar(event, { ...division, eventId: 'other' }, 'Morgan / Lee', now)).toBeNull()
    expect(buildTournamentNextMatchCalendar(event, { ...division, status: 'completed' }, 'Morgan / Lee', now)).toBeNull()
    expect(buildTournamentNextMatchCalendar(event, { ...division, results: { 'r1-m1': { winner: 'Morgan / Lee', score: '6-4', updatedAt: '' } } }, 'Morgan / Lee', now)).toBeNull()
    expect(buildTournamentNextMatchCalendar({ ...event, eventDetails: {} }, division, 'Morgan / Lee', now)).toBeNull()
  })
  it('preserves match identity through a schedule change and folds escaped Unicode content safely', () => {
    const first = buildTournamentNextMatchCalendar(event, division, 'Morgan / Lee', now)!
    const second = buildTournamentNextMatchCalendar({ ...event, name: '🎃'.repeat(60) + '\nBEGIN:VEVENT' }, { ...division, schedule: { 'r1-m1': { ...division.schedule['r1-m1'], time: '18:00', court: '3' } } }, 'Chris / Jamie', now)!
    expect(first.content.match(/UID:.*\r\n/)?.[0]).toBe(second.content.match(/UID:.*\r\n/)?.[0])
    expect(second.content).toContain('DTSTART:20261017T230000Z')
    expect(second.content.split('\r\n').every(line => new TextEncoder().encode(line).length <= 75)).toBe(true)
    expect(unfold(second.content)).toContain('\\nBEGIN:VEVENT')
    expect(second.content.split('\r\n').filter(line => line === 'BEGIN:VEVENT')).toHaveLength(1)
  })
})
