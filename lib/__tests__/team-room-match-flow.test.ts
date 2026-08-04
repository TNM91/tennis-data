import { describe, expect, it } from 'vitest'
import {
  buildLineupChangeNotice,
  buildLineupChanges,
  buildTeamRoomCourtReadiness,
  canRespondToLineupChange,
  getLineupChangeReminderAt,
  parseReminderTargets,
  selectPrimaryTeamRoomCourtReadiness,
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

  it('identifies only the players affected by a saved replacement', () => {
    expect(buildLineupChangeNotice([
      { label: '4.5 Doubles', players: ['Jordan Lee', 'Morgan Net'] },
      { label: '4.0 Doubles', players: ['Casey Court', 'Taylor Topspin'] },
    ], [
      { label: '4.5 Doubles', players: ['Alex Ace', 'Morgan Net'] },
      { label: '4.0 Doubles', players: ['Casey Court', 'Taylor Topspin'] },
    ], {
      courtLabel: '4.5 Doubles',
      outgoingPlayerName: 'Jordan Lee',
      replacementPlayerName: 'Alex Ace',
    })).toEqual({
      courtLabel: '4.5 Doubles',
      outgoingPlayerName: 'Jordan Lee',
      replacementPlayerName: 'Alex Ace',
      affectedNames: ['Jordan Lee', 'Alex Ace', 'Morgan Net'],
      beforePlayers: ['Jordan Lee', 'Morgan Net'],
      afterPlayers: ['Alex Ace', 'Morgan Net'],
    })
  })

  it('rejects a replacement notice when the named court change does not match', () => {
    expect(buildLineupChangeNotice(
      [{ label: 'Doubles 1', players: ['Jordan Lee', 'Morgan Net'] }],
      [{ label: 'Doubles 1', players: ['Alex Ace', 'Morgan Net'] }],
      { courtLabel: 'Doubles 2', outgoingPlayerName: 'Jordan Lee', replacementPlayerName: 'Alex Ace' },
    )).toBeNull()
  })

  it('allows only the linked replacement identity to answer the court change', () => {
    expect(canRespondToLineupChange('Alex Ace', ['Alex Ace', 'Alex A.'])).toBe(true)
    expect(canRespondToLineupChange('Alex Ace', ['Jordan Lee', 'Casey Court'])).toBe(false)
  })

  it('reduces every projected court to a clear readiness action', () => {
    expect(buildTeamRoomCourtReadiness({
      lineup: [
        { label: '4.5 Doubles', players: ['Alex Ace', 'Jordan Lee'] },
        { label: '4.0 Doubles', players: ['Casey Court', 'Taylor Topspin'] },
        { label: '3.5 Doubles', players: ['Morgan Net', 'Riley Rally'] },
        { label: 'Doubles 4', players: [] },
      ],
      replies: [
        { status: 'yes', names: ['Alex Ace', 'Jordan Lee', 'Casey Court', 'Taylor Topspin', 'Morgan Net'] },
        { status: 'maybe', names: ['Casey Court'] },
        { status: 'no', names: [] },
        { status: 'waiting', names: ['Riley Rally'] },
      ],
    }).map(({ label, status }) => ({ label, status }))).toEqual([
      { label: '4.5 Doubles', status: 'confirmed' },
      { label: '4.0 Doubles', status: 'needs_captain' },
      { label: '3.5 Doubles', status: 'waiting' },
      { label: 'Doubles 4', status: 'needs_captain' },
    ])
  })

  it('makes an unsent or overdue replacement court a captain action', () => {
    const lineup = [{ label: '4.5 Doubles', players: ['Alex Ace', 'Jordan Lee'] }]
    const replies = [{ status: 'yes' as const, names: ['Alex Ace', 'Jordan Lee'] }]
    expect(buildTeamRoomCourtReadiness({
      lineup,
      replies,
      lineupChange: { courtLabel: '4.5 Doubles', pending: true, response: '', deadlineStatus: '' },
    })[0]?.status).toBe('needs_captain')
    expect(buildTeamRoomCourtReadiness({
      lineup,
      replies,
      lineupChange: { courtLabel: '4.5 Doubles', pending: false, response: '', deadlineStatus: 'reminded' },
    })[0]?.status).toBe('needs_captain')
  })

  it('puts a captain decision ahead of a waiting court', () => {
    expect(selectPrimaryTeamRoomCourtReadiness([
      { label: '4.5 Doubles', status: 'waiting' as const },
      { label: '4.0 Doubles', status: 'needs_captain' as const },
      { label: '3.5 Doubles', status: 'confirmed' as const },
    ])?.label).toBe('4.0 Doubles')
    expect(selectPrimaryTeamRoomCourtReadiness([
      { label: '4.5 Doubles', status: 'confirmed' as const },
    ])).toBeNull()
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
      { profileId: 'player-1', needsResponse: true, needsMaybeFollowup: false, needsAckVersion: 2, needsLineupChangeResponse: false },
      { profileId: 'player-1', needsResponse: false, needsMaybeFollowup: false, needsAckVersion: 0, needsLineupChangeResponse: false },
      { profileId: 'player-2', needsResponse: false, needsMaybeFollowup: true, needsAckVersion: 1, needsLineupChangeResponse: true },
      { profileId: '', needsResponse: true },
    ])).toEqual([
      { profileId: 'player-1', needsResponse: true, needsMaybeFollowup: false, needsAckVersion: 2, needsLineupChangeResponse: false },
      { profileId: 'player-2', needsResponse: false, needsMaybeFollowup: true, needsAckVersion: 1, needsLineupChangeResponse: true },
    ])
  })

  it('maps a captain reply-by date to the free morning reminder run', () => {
    expect(getLineupChangeReminderAt('2026-08-08')).toBe('2026-08-08T13:55:00.000Z')
    expect(getLineupChangeReminderAt('2026-02-30')).toBe('')
    expect(getLineupChangeReminderAt('not-a-date')).toBe('')
  })
})
