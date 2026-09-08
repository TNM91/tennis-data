import { describe, expect, it } from 'vitest'
import { buildCaptainMessagingAudienceCopy } from '../captain-messaging-audience'

describe('captain messaging audience copy', () => {
  it('distinguishes selected lineup players from the full roster', () => {
    const copy = buildCaptainMessagingAudienceCopy({
      lineupPlayers: 7,
      lineupTextsOpened: 0,
      rosterPlayers: 12,
      rosterNeedsStatus: 12,
      rosterAvailable: 0,
      matchConfirmed: 0,
      matchRepliesPending: 12,
    })

    expect(copy.lineupProgress).toBe('0 of 7 selected-player texts opened')
    expect(copy.lineupScope).toBe('Lineup check: 7 selected players. Full roster: 12 players.')
    expect(copy.rosterNeedsStatus).toBe('12 of 12 roster players need status')
    expect(copy.rosterPlayers).toBe('12 roster players')
    expect(copy.matchRepliesPending).toBe('12 match replies pending')
  })

  it('handles singular and complete states cleanly', () => {
    const copy = buildCaptainMessagingAudienceCopy({
      lineupPlayers: 1,
      lineupTextsOpened: 1,
      rosterPlayers: 1,
      rosterNeedsStatus: 0,
      rosterAvailable: 1,
      matchConfirmed: 1,
      matchRepliesPending: 1,
    })

    expect(copy.lineupScope).toBe('Lineup check: 1 selected player. Full roster: 1 player.')
    expect(copy.rosterNeedsStatus).toBe('Full-roster availability complete')
    expect(copy.matchRepliesPending).toBe('1 match reply pending')
  })
})
