import { describe, expect, it } from 'vitest'
import {
  buildPotentialLineupAvailabilityMessage,
  buildPlayerPotentialLineupAvailabilityMessage,
  extractPotentialLineupPlayers,
  readCaptainLineupHandoff,
} from '../captain-lineup-handoff'

const slots = [
  {
    id: 'd1',
    label: '3.5 Doubles',
    players: [
      { playerId: '1', playerName: 'Alex Ace' },
      { playerId: '2', playerName: 'Pat Volley' },
    ],
  },
]

describe('captain potential-lineup handoff', () => {
  it('builds a match-specific availability text that works without a TiQ account', () => {
    const message = buildPotentialLineupAvailabilityMessage({
      teamName: 'TIQ Team',
      opponent: 'Racquet Club',
      dateText: 'August 8',
      time: '7:00 PM',
      facility: 'Forest Lake',
      slotsJson: slots,
      availabilityRequestUrl: 'https://www.tenaceiq.com/availability/token',
    })

    expect(message).toContain('Potential lineup for August 8 vs Racquet Club')
    expect(message).toContain('3.5 Doubles: Alex Ace / Pat Volley')
    expect(message).toContain('Reply YES, NO, or MAYBE')
    expect(message).toContain('Time: 7:00 PM')
    expect(message).toContain('Location: Forest Lake')
    expect(message).toContain('Set this match or other season dates')
    expect(message).toContain('one-tap Yes or No response')
  })

  it('extracts each projected player once', () => {
    expect(extractPotentialLineupPlayers([...slots, ...slots])).toEqual(['Alex Ace', 'Pat Volley'])
  })

  it('gives each player only their proposed court and doubles partner', () => {
    const message = buildPlayerPotentialLineupAvailabilityMessage({
      playerName: 'Alex Ace',
      teamName: 'TIQ Team',
      opponent: 'Racquet Club',
      dateText: 'August 8',
      time: '7:00 PM',
      facility: 'Forest Lake',
      slotsJson: slots,
      availabilityRequestUrl: 'https://www.tenaceiq.com/availability/alex-token',
    })

    expect(message).toContain('Your proposed court: 3.5 Doubles with Pat Volley.')
    expect(message).toContain('Reply in TiQ: https://www.tenaceiq.com/availability/alex-token')
    expect(message).not.toContain('3.5 Doubles: Alex Ace / Pat Volley')
  })

  it('says when a doubles teammate is still being determined', () => {
    const message = buildPlayerPotentialLineupAvailabilityMessage({
      playerName: 'Alex Ace',
      teamName: 'TiQ Team',
      opponent: 'Racquet Club',
      dateText: 'August 8',
      time: '7:00 PM',
      facility: 'Forest Lake',
      slotsJson: [{ ...slots[0], players: [slots[0].players[0]] }],
      availabilityRequestUrl: 'https://www.tenaceiq.com/availability/alex-token',
    })

    expect(message).toContain('Your proposed court: 3.5 Doubles. Your teammate is still being determined.')
    expect(message).toContain('Add it to your iPhone calendar, then set future availability below.')
  })

  it('rejects invalid stored handoffs', () => {
    expect(readCaptainLineupHandoff('{"version":2}')).toBeNull()
    expect(readCaptainLineupHandoff('not json')).toBeNull()
  })

  it('keeps private player links in the saved handoff', () => {
    const handoff = readCaptainLineupHandoff(JSON.stringify({
      version: 1,
      intent: 'confirm-availability',
      scenario: { id: 'scenario-1' },
      playerRequestUrls: [{ playerId: 'player-1', playerName: 'Alex Ace', requestUrl: '/availability/private-token' }],
    }))

    expect(handoff?.playerRequestUrls?.[0].playerName).toBe('Alex Ace')
  })

  it('reads a pending direct court text handoff so a pair stays in order on return', async () => {
    const { readCaptainDirectCourtTextHandoff } = await import('../captain-lineup-handoff')
    const handoff = readCaptainDirectCourtTextHandoff(JSON.stringify({
      version: 1,
      courtId: 'court-1',
      courtLabel: '4.0 Doubles',
      requestId: 'request-1',
      match: { date: '2026-08-31', time: '6:30 PM', facility: 'Club', opponent: 'Hamilton' },
      slotsJson: slots,
      players: [
        { playerId: 'player-1', playerName: 'Alex Ace', requestUrl: '/availability/alex' },
        { playerId: 'player-2', playerName: 'Blair Ball', requestUrl: '/availability/blair' },
      ],
      openedPlayerKeys: ['alex ace'],
    }))

    expect(handoff?.players.map((player) => player.playerName)).toEqual(['Alex Ace', 'Blair Ball'])
    expect(handoff?.openedPlayerKeys).toEqual(['alex ace'])
  })
})
