import { describe, expect, it } from 'vitest'
import { buildTeamRoomMapsHref, getTeamRoomMatchDayPhase } from '../team-room-match-day'

describe('Team Room match-day handoff', () => {
  it('moves one final lineup from prep to match day to post-match', () => {
    expect(getTeamRoomMatchDayPhase({
      matchDate: '2026-08-12',
      localDateKey: '2026-08-11',
    })).toBe('upcoming')
    expect(getTeamRoomMatchDayPhase({
      matchDate: '2026-08-12',
      localDateKey: '2026-08-12',
    })).toBe('match_day')
    expect(getTeamRoomMatchDayPhase({
      matchDate: '2026-08-12',
      localDateKey: '2026-08-13',
    })).toBe('post_match')
  })

  it('opens post-match as soon as the captain marks the match complete', () => {
    expect(getTeamRoomMatchDayPhase({
      matchDate: '2026-08-12',
      localDateKey: '2026-08-12',
      matchCompletedAt: '2026-08-12T22:10:00.000Z',
    })).toBe('post_match')
  })

  it('builds a safe one-tap maps search from the saved facility', () => {
    expect(buildTeamRoomMapsHref('Forest Lake Tennis Club')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Forest%20Lake%20Tennis%20Club',
    )
    expect(buildTeamRoomMapsHref('')).toBe('')
  })
})
