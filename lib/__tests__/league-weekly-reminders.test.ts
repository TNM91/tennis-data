import { describe, expect, it } from 'vitest'
import { buildLeagueWeeklyCourts } from '../league-weekly-format'
import { buildLeagueWeeklyEmail, getLeagueWeeklyDeliveryKind } from '../league-weekly-reminders'

describe('weekly league reminders', () => {
  it('opens replies Monday morning in the league time zone', () => {
    expect(getLeagueWeeklyDeliveryKind({
      now: new Date('2026-09-28T13:15:00Z'),
      timeZone: 'America/Chicago',
      playOn: '2026-10-01',
      status: 'collecting',
    })).toBe('availability_open')
  })

  it('sends the court plan on play-day morning only after publishing', () => {
    expect(getLeagueWeeklyDeliveryKind({
      now: new Date('2026-10-01T13:15:00Z'),
      timeZone: 'America/Chicago',
      playOn: '2026-10-01',
      status: 'published',
    })).toBe('court_plan')
    expect(getLeagueWeeklyDeliveryKind({
      now: new Date('2026-10-01T13:15:00Z'),
      timeZone: 'America/Chicago',
      playOn: '2026-10-01',
      status: 'collecting',
    })).toBeNull()
  })

  it('puts a player’s court wave and group into the court-plan email', () => {
    const assignments = buildLeagueWeeklyCourts(['Alex', 'Blair', 'Casey', 'Drew'], { courtCount: 1, startTimes: ['08:30'] })
    expect(buildLeagueWeeklyEmail({
      kind: 'court_plan',
      leagueName: 'Thursday Doubles',
      playOn: '2026-10-01',
      playerName: 'Alex',
      facility: 'Riverside',
      assignments,
      href: 'https://example.com/league-week/token',
    })).toMatchObject({
      subject: 'Thursday Doubles: courts for 2026-10-01',
      body: 'Court 1 at 08:30. You’ll play with Blair, Casey, Drew. Site: Riverside.',
    })
  })
})
