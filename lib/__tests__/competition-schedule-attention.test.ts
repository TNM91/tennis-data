import { describe, expect, it } from 'vitest'
import { buildOrganizerScheduleAttentionItems } from '../competition-schedule-attention'

describe('organizer schedule attention', () => {
  it('prioritizes unavailable, changed, and waiting match replies', () => {
    const sharedEvent = {
      competitionKind: 'league' as const,
      competitionId: 'league-1',
      competitionName: 'Monday Singles',
      time: '19:00',
      location: 'Court 5',
      href: '/league-1',
    }
    const events = [
      {
        ...sharedEvent,
        eventId: 'league:league-1:match-1',
        matchLabel: 'Avery vs Blake',
        date: '2026-09-03',
        players: [
          { userId: 'player-1', playerName: 'Avery' },
          { userId: 'player-2', playerName: 'Blake' },
        ],
      },
      {
        ...sharedEvent,
        eventId: 'league:league-1:match-2',
        matchLabel: 'Casey vs Drew',
        date: '2026-09-02',
        players: [
          { userId: 'player-3', playerName: 'Casey' },
          { userId: 'player-4', playerName: 'Drew' },
        ],
      },
      {
        ...sharedEvent,
        eventId: 'league:league-1:match-3',
        matchLabel: 'Ellis vs Finley',
        date: '2026-09-01',
        players: [
          { userId: 'player-5', playerName: 'Ellis' },
          { userId: 'player-6', playerName: 'Finley' },
        ],
      },
    ]
    const currentSnapshot = { date: '2026-09-03', time: '19:00', location: 'Court 5' }
    const items = buildOrganizerScheduleAttentionItems({
      events,
      today: '2026-09-01',
      responses: [
        {
          eventId: 'league:league-1:match-1',
          playerUserId: 'player-1',
          response: 'unavailable',
          eventSnapshot: currentSnapshot,
        },
        {
          eventId: 'league:league-1:match-1',
          playerUserId: 'player-2',
          response: 'available',
          eventSnapshot: currentSnapshot,
        },
        {
          eventId: 'league:league-1:match-2',
          playerUserId: 'player-3',
          response: 'available',
          eventSnapshot: { date: '2026-09-01', time: '19:00', location: 'Court 5' },
        },
        {
          eventId: 'league:league-1:match-2',
          playerUserId: 'player-4',
          response: 'available',
          eventSnapshot: { date: '2026-09-02', time: '19:00', location: 'Court 5' },
        },
      ],
    })

    expect(items.map((item) => item.state)).toEqual(['unavailable', 'changed', 'waiting'])
    expect(items[0]).toMatchObject({ availableCount: 1, unavailableCount: 1 })
    expect(items[1]).toMatchObject({ availableCount: 1, changedCount: 1 })
    expect(items[2]).toMatchObject({ waitingCount: 2 })
  })

  it('hides fully answered and past matches', () => {
    const items = buildOrganizerScheduleAttentionItems({
      today: '2026-09-02',
      events: [{
        eventId: 'tournament:t-1:r1-m1',
        competitionKind: 'tournament',
        competitionId: 't-1',
        competitionName: 'Club Cup',
        matchLabel: 'Avery vs Blake',
        date: '2026-09-01',
        time: '09:00',
        location: 'Court 2',
        href: '/t-1',
        players: [{ userId: 'player-1', playerName: 'Avery' }],
      }],
      responses: [],
    })

    expect(items).toEqual([])
  })
})
