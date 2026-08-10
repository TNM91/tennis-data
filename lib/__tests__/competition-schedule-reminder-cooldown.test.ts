import { describe, expect, it } from 'vitest'
import { splitCompetitionReminderTargetsByCooldown } from '../competition-schedule-reminder-cooldown'

describe('competition schedule reminder cooldown', () => {
  it('blocks the same player and schedule snapshot for 24 hours', () => {
    const snapshot = { date: '2026-09-03', time: '19:00', location: 'Court 5' }
    const result = splitCompetitionReminderTargetsByCooldown({
      eventId: 'league:league-1:match-1',
      currentSnapshot: snapshot,
      now: '2026-09-02T18:00:00.000Z',
      targets: [
        { playerUserId: 'player-1', playerName: 'Avery' },
        { playerUserId: 'player-2', playerName: 'Blake' },
      ],
      history: [{
        eventId: 'league:league-1:match-1',
        playerUserId: 'player-1',
        eventSnapshot: snapshot,
        sentAt: '2026-09-02T12:00:00.000Z',
      }],
    })

    expect(result.coolingDown.map((target) => target.playerUserId)).toEqual(['player-1'])
    expect(result.eligible.map((target) => target.playerUserId)).toEqual(['player-2'])
    expect(result.nextReminderAt).toBe('2026-09-03T12:00:00.000Z')
    expect(result.lastReminderAt).toBe('2026-09-02T12:00:00.000Z')
  })

  it('allows a new reminder immediately after the schedule changes', () => {
    const result = splitCompetitionReminderTargetsByCooldown({
      eventId: 'tournament:t-1:r1-m1',
      currentSnapshot: { date: '2026-09-04', time: '10:00', location: 'Court 2' },
      now: '2026-09-02T18:00:00.000Z',
      targets: [{ playerUserId: 'player-1', playerName: 'Avery' }],
      history: [{
        eventId: 'tournament:t-1:r1-m1',
        playerUserId: 'player-1',
        eventSnapshot: { date: '2026-09-03', time: '10:00', location: 'Court 2' },
        sentAt: '2026-09-02T17:00:00.000Z',
      }],
    })

    expect(result.coolingDown).toEqual([])
    expect(result.eligible).toHaveLength(1)
  })
})
