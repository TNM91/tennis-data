import { describe, expect, it } from 'vitest'
import { buildPlayerWeeklyLeagueAction, type PlayerWeeklyLeagueNotification } from '../player-weekly-league-home'

const now = new Date('2026-10-01T15:00:00Z')

function notification(overrides: Partial<PlayerWeeklyLeagueNotification> = {}): PlayerWeeklyLeagueNotification {
  return {
    id: 'notice-1',
    title: 'In or out for 2026-10-01?',
    body: 'Reply for this week’s Thursday Doubles roster at Riverside.',
    href: '/league-week/private-token',
    createdAt: '2026-09-28T13:00:00Z',
    ...overrides,
  }
}

describe('player weekly league home action', () => {
  it('turns the private availability notification into a My Lab reply action', () => {
    expect(buildPlayerWeeklyLeagueAction([notification()], now)).toMatchObject({
      href: '/league-week/private-token',
      cta: 'Reply in or out',
      stage: 'availability',
    })
  })

  it('prefers the newest weekly notice and advances to the court scorecard', () => {
    expect(buildPlayerWeeklyLeagueAction([
      notification(),
      notification({
        id: 'notice-2',
        title: 'Your weekly court plan is ready.',
        body: 'Court 4 at 08:30. You’ll play with Blair, Casey, Drew.',
        createdAt: '2026-10-01T13:00:00Z',
      }),
    ], now)).toMatchObject({
      notificationId: 'notice-2',
      title: 'Your court is ready.',
      cta: 'Open court & scores',
      stage: 'courts',
    })
  })

  it('uses a later weekly notice as the recap handoff', () => {
    expect(buildPlayerWeeklyLeagueAction([
      notification({
        title: 'Thursday night highlights',
        body: 'Three tight tiebreaks and a great welcome for Jordan.',
        createdAt: '2026-10-02T13:00:00Z',
      }),
    ], new Date('2026-10-02T15:00:00Z'))).toMatchObject({
      cta: 'Read recap',
      stage: 'recap',
    })
  })

  it('ignores non-league and stale links', () => {
    expect(buildPlayerWeeklyLeagueAction([
      notification({ href: '/captain', createdAt: '2026-10-01T13:00:00Z' }),
      notification({ id: 'old', createdAt: '2026-09-01T13:00:00Z' }),
    ], now)).toBeNull()
  })
})
