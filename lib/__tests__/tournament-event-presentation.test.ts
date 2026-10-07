import { describe, expect, it } from 'vitest'
import { buildTournamentEventSignupHref, formatTournamentEventTime, isTournamentEventRegistrationClosed, normalizeTournamentEventDetails } from '../tournament-event-presentation'
import type { TiqTournamentRecord } from '../tiq-tournament-registry'

const event = {
  name: 'Pumpkin Playoffs', startsOn: '2026-10-17', status: 'draft', registrationEmail: 'leskotennis11@gmail.com',
  eventDetails: { directorName: 'Michael Lesko', registrationClosesOn: '2026-10-14', timeZone: 'America/Chicago' },
} as TiqTournamentRecord

describe('tournament event signup presentation', () => {
  it('prefills the selected division and partner details without sending an email', () => {
    const division = { name: "Men's 4.5 Doubles", entrantType: 'teams' } as TiqTournamentRecord
    const link = buildTournamentEventSignupHref(event, division)
    expect(link).toMatch(/^mailto:leskotennis11@gmail\.com\?/)
    const params = new URLSearchParams(link.split('?')[1])
    expect(params.get('subject')).toContain("Men's 4.5 Doubles")
    expect(params.get('body')).toContain('Partner name:')
    expect(params.get('body')).not.toContain('4.0')
    expect(buildTournamentEventSignupHref(event)).toBe('')
  })
  it('keeps registration open through the deadline in the event time zone', () => {
    expect(isTournamentEventRegistrationClosed(event, new Date('2026-10-15T04:59:00Z'))).toBe(false)
    expect(isTournamentEventRegistrationClosed(event, new Date('2026-10-15T05:01:00Z'))).toBe(true)
    expect(isTournamentEventRegistrationClosed({ ...event, status: 'completed' }, new Date('2026-10-07T00:00:00Z'))).toBe(true)
  })
  it('does not turn invalid dates, times, fees, or time zones into displayed event facts', () => {
    expect(normalizeTournamentEventDetails({ startsAt: '25:99', registrationClosesOn: '2026-02-30',
      feePerPlayer: -40, feePerTeam: NaN, timeZone: 'Not/AZone', sponsors: ['Woodsmill', null] })).toEqual({ sponsors: ['Woodsmill'] })
    expect(formatTournamentEventTime('17:30')).toBe('5:30 PM')
    expect(formatTournamentEventTime('')).toBe('Time to be confirmed')
  })
})
