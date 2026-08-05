import { describe, expect, it } from 'vitest'
import {
  getCaptainLocalDateKey,
  getCaptainMobileActionLayout,
  getCaptainMobileMatchPhase,
  orderCaptainMobileNowItems,
  shouldShowCaptainMobileTeamSelect,
} from '../captain-mobile-actions'

describe('Captain mobile action priority', () => {
  it('uses the captain local calendar day', () => {
    expect(getCaptainLocalDateKey(new Date(2026, 7, 4, 23, 30))).toBe('2026-08-04')
  })

  it('hides the team selector only when one linked team is ready', () => {
    expect(shouldShowCaptainMobileTeamSelect(true, 1)).toBe(true)
    expect(shouldShowCaptainMobileTeamSelect(false, 0)).toBe(true)
    expect(shouldShowCaptainMobileTeamSelect(false, 1)).toBe(false)
    expect(shouldShowCaptainMobileTeamSelect(false, 2)).toBe(true)
  })

  it('classifies setup, upcoming, match-day, and past work', () => {
    expect(getCaptainMobileMatchPhase('', '2026-08-04')).toBe('setup')
    expect(getCaptainMobileMatchPhase('2026-08-05', '2026-08-04')).toBe('upcoming')
    expect(getCaptainMobileMatchPhase('2026-08-04', '2026-08-04')).toBe('match_day')
    expect(getCaptainMobileMatchPhase('2026-08-03', '2026-08-04')).toBe('past')
  })

  it('keeps availability first while replies are missing', () => {
    expect(getCaptainMobileActionLayout({
      matchDate: '2026-08-09',
      todayDate: '2026-08-04',
      pendingAvailabilityCount: 4,
      hasAvailabilityReplies: true,
      lineupReady: false,
    })).toMatchObject({
      visible: ['availability', 'lineup', 'chat'],
      overflow: ['scorecard'],
    })
  })

  it('moves availability under More once everyone has replied', () => {
    expect(getCaptainMobileActionLayout({
      matchDate: '2026-08-09',
      todayDate: '2026-08-04',
      pendingAvailabilityCount: 0,
      hasAvailabilityReplies: true,
      lineupReady: false,
    })).toMatchObject({
      visible: ['lineup', 'chat'],
      overflow: ['availability', 'scorecard'],
    })
  })

  it('brings scorecard forward on match day and after the match', () => {
    expect(getCaptainMobileActionLayout({
      matchDate: '2026-08-04',
      todayDate: '2026-08-04',
      pendingAvailabilityCount: 0,
      hasAvailabilityReplies: true,
      lineupReady: true,
    })).toMatchObject({
      visible: ['lineup', 'chat', 'scorecard'],
      overflow: ['availability'],
    })
    expect(getCaptainMobileActionLayout({
      matchDate: '2026-08-03',
      todayDate: '2026-08-04',
      pendingAvailabilityCount: 0,
      hasAvailabilityReplies: true,
      lineupReady: true,
    })).toMatchObject({
      visible: ['scorecard', 'chat'],
      overflow: ['availability', 'lineup'],
    })
  })

  it('keeps only the most urgent Captain notice open', () => {
    const items = orderCaptainMobileNowItems([
      { id: 'availability-complete' as const, label: 'Complete' },
      { id: 'team-improvement' as const, label: 'Improve' },
      { id: 'availability-open' as const, label: 'Availability' },
      { id: 'lineup-confirmed' as const, label: 'Confirmed' },
      { id: 'lineup-locked' as const, label: 'Locked' },
      { id: 'reply' as const, label: 'Reply' },
      { id: 'court-readiness' as const, label: 'Court' },
    ])

    expect(items.map((item) => item.label)).toEqual(['Locked', 'Confirmed', 'Court', 'Reply', 'Availability', 'Improve', 'Complete'])
  })

  it('puts a directly linked reply ahead of every other notice', () => {
    const items = orderCaptainMobileNowItems([
      { id: 'court-readiness' as const, label: 'Court' },
      { id: 'reply-focus' as const, label: 'Focused reply' },
      { id: 'availability-open' as const, label: 'Availability' },
    ])

    expect(items[0]?.label).toBe('Focused reply')
  })
})
