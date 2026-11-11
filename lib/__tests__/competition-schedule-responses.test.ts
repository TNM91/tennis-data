import { describe, expect, it } from 'vitest'
import { buildCompetitionScheduleResponseSummary } from '../competition-schedule-responses'

describe('competition schedule response summaries', () => {
  it('shows organizer-ready availability, waiting, and changed replies', () => {
    const summary = buildCompetitionScheduleResponseSummary({
      eventId: 'tournament:event-1:r1-m1',
      expectedPlayerNames: ['Avery Stone', 'Blake Carter', 'Casey Nguyen'],
      currentSnapshot: {
        date: '2026-08-15',
        time: '09:00',
        location: 'Vetta West · Court 2',
      },
      responses: [
        {
          eventId: 'tournament:event-1:r1-m1',
          playerName: 'Avery Stone',
          response: 'available',
          eventSnapshot: {
            date: '2026-08-15',
            time: '09:00',
            location: 'Vetta West · Court 2',
          },
          updatedAt: '2026-08-10T12:00:00.000Z',
        },
        {
          eventId: 'tournament:event-1:r1-m1',
          playerName: 'Blake Carter',
          response: 'unavailable',
          eventSnapshot: {
            date: '2026-08-14',
            time: '09:00',
            location: 'Vetta West · Court 2',
          },
          updatedAt: '2026-08-10T12:05:00.000Z',
        },
      ],
    })

    expect(summary).toMatchObject({
      availableCount: 1,
      unavailableCount: 0,
      waitingCount: 1,
      changedCount: 1,
      needsAction: true,
    })
    expect(summary.rows.map((row) => [row.playerName, row.state])).toEqual([
      ['Avery Stone', 'available'],
      ['Blake Carter', 'changed'],
      ['Casey Nguyen', 'waiting'],
    ])
  })

  it('keeps a current no reply actionable for the organizer', () => {
    const summary = buildCompetitionScheduleResponseSummary({
      eventId: 'league:league-1:match-1',
      expectedPlayerNames: ['Avery Stone', 'Blake Carter'],
      currentSnapshot: { date: '2026-08-15', time: '18:00', location: 'Court 4' },
      responses: [{
        eventId: 'league:league-1:match-1',
        playerName: 'Blake Carter',
        response: 'unavailable',
        eventSnapshot: { date: '2026-08-15', time: '18:00', location: 'Court 4' },
        updatedAt: '2026-08-10T12:00:00.000Z',
      }],
    })

    expect(summary.unavailableCount).toBe(1)
    expect(summary.waitingCount).toBe(1)
    expect(summary.needsAction).toBe(true)
  })

  it('asks again only when the actual tournament start or court changes', () => {
    const eventId = 'tournament:event-1:r1-m1'
    const response = {
      eventId, playerName: 'Avery Stone', response: 'available' as const,
      eventSnapshot: { date: '2026-08-15', time: '18:00:00', location: 'Northside · Court Court 5' },
      updatedAt: '2026-08-10T12:00:00Z',
    }
    const current = { date: '2026-08-15', time: '18:00', location: 'Northside · Court 5' }
    const summarize = (currentSnapshot: typeof current) => buildCompetitionScheduleResponseSummary({
      eventId, expectedPlayerNames: ['Avery Stone'], responses: [response], currentSnapshot,
    })
    expect(summarize(current)).toMatchObject({ availableCount: 1, changedCount: 0 })
    expect(summarize({ ...current, time: '19:00' })).toMatchObject({ availableCount: 0, changedCount: 1 })
    expect(summarize({ ...current, location: 'Northside · Court 6' })).toMatchObject({ availableCount: 0, changedCount: 1 })
  })
})
