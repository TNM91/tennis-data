import { describe, expect, it } from 'vitest'
import { summarizeTeamRoomAvailability } from '../team-room-availability'

describe('Team Room availability summary', () => {
  it('combines private-link replies into one invited-player count', () => {
    expect(summarizeTeamRoomAvailability({
      matchDate: '2026-08-08',
      scenarioId: 'scenario-1',
      invites: [
        { playerId: 'player-1', playerName: 'Alex Ace' },
        { playerId: 'player-2', playerName: 'Casey Court' },
        { playerName: 'Morgan Match' },
        { playerName: 'Taylor Tennis' },
      ],
      responses: [
        { playerId: 'player-1', playerName: 'Alex Ace', matchDate: '2026-08-08', status: 'available' },
        { playerId: 'player-2', playerName: 'Casey Court', matchDate: '2026-08-08', status: 'maybe' },
        { playerName: 'Morgan Match', matchDate: '2026-08-08', status: 'unavailable' },
        { playerName: 'Taylor Tennis', matchDate: '2026-08-15', status: 'available' },
      ],
    })).toEqual({
      yes: 1,
      maybe: 1,
      no: 1,
      waiting: 1,
      total: 4,
      yesNames: ['Alex Ace'],
      waitingNames: ['Taylor Tennis'],
      maybeNames: ['Casey Court'],
      noNames: ['Morgan Match'],
      scenarioId: 'scenario-1',
    })
  })

  it('deduplicates invites and keeps the latest reply', () => {
    const summary = summarizeTeamRoomAvailability({
      matchDate: '2026-08-08',
      invites: [
        { playerName: 'Alex Ace' },
        { playerName: ' Alex  Ace ' },
      ],
      responses: [
        { playerName: 'Alex Ace', matchDate: '2026-08-08', status: 'maybe', respondedAt: '2026-08-01T10:00:00Z' },
        { playerName: 'Alex Ace', matchDate: '2026-08-08', status: 'available', respondedAt: '2026-08-01T11:00:00Z' },
      ],
    })

    expect(summary).toMatchObject({ yes: 1, maybe: 0, no: 0, waiting: 0, total: 1 })
  })

  it('treats captain-confirmed final-lineup players as fully answered', () => {
    const confirmedAt = '9999-12-31T23:59:59.999Z'
    const players = ['Sam Edwards', 'Michael Ho', 'Nathan Meinert', 'David Cabrera']
    const summary = summarizeTeamRoomAvailability({
      matchDate: '2026-09-14',
      invites: players.map((playerName) => ({ playerName })),
      responses: players.map((playerName) => ({
        playerName,
        matchDate: '2026-09-14',
        status: 'yes',
        respondedAt: confirmedAt,
      })),
    })

    expect(summary).toMatchObject({ yes: 4, maybe: 0, no: 0, waiting: 0, total: 4 })
    expect(summary.yesNames).toEqual(players)
    expect(summary.waitingNames).toEqual([])
  })
})
