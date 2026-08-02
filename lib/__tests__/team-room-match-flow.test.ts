import { describe, expect, it } from 'vitest'
import {
  buildLineupChanges,
  parseReminderTargets,
  selectActiveTeamRoomCard,
  teamRoomCardState,
} from '../team-room-match-flow'

describe('Team Room match-week flow', () => {
  it('shows only the changed court when a projected lineup is revised', () => {
    expect(buildLineupChanges([
      { label: '4.5 Doubles', players: ['Alex', 'Jordan'] },
      { label: '4.0 Doubles', players: ['Casey', 'Taylor'] },
    ], [
      { label: '4.5 Doubles', players: ['Alex', 'Jordan'] },
      { label: '4.0 Doubles', players: ['Morgan', 'Taylor'] },
    ])).toEqual(['4.0 Doubles: Casey / Taylor -> Morgan / Taylor'])
  })

  it('pins the next match and automatically archives past match cards', () => {
    const cards = [
      { id: 'past', matchDate: '2026-08-01', createdAt: '2026-07-20T12:00:00Z' },
      { id: 'later', matchDate: '2026-08-12', createdAt: '2026-08-01T12:00:00Z' },
      { id: 'next', matchDate: '2026-08-08', createdAt: '2026-08-02T12:00:00Z' },
    ]
    const activeId = selectActiveTeamRoomCard(cards, '2026-08-02')
    expect(activeId).toBe('next')
    expect(teamRoomCardState(cards[0], activeId, '2026-08-02')).toBe('archived')
    expect(teamRoomCardState(cards[1], activeId, '2026-08-02')).toBe('upcoming')
    expect(teamRoomCardState(cards[2], activeId, '2026-08-02')).toBe('active')
  })

  it('deduplicates and validates reminder targets', () => {
    expect(parseReminderTargets([
      { profileId: 'player-1', needsResponse: true, needsMaybeFollowup: false, needsAckVersion: 2 },
      { profileId: 'player-1', needsResponse: false, needsMaybeFollowup: false, needsAckVersion: 0 },
      { profileId: 'player-2', needsResponse: false, needsMaybeFollowup: true, needsAckVersion: 1 },
      { profileId: '', needsResponse: true },
    ])).toEqual([
      { profileId: 'player-1', needsResponse: true, needsMaybeFollowup: false, needsAckVersion: 2 },
      { profileId: 'player-2', needsResponse: false, needsMaybeFollowup: true, needsAckVersion: 1 },
    ])
  })
})
