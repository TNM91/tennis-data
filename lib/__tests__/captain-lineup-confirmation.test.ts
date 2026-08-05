import { describe, expect, it } from 'vitest'
import {
  buildCaptainLineupConfirmationId,
  buildCaptainLineupConfirmationShareBody,
  hasSeenCaptainLineupConfirmation,
  rememberCaptainLineupConfirmation,
} from '../captain-lineup-confirmation'

const change = {
  messageId: 'message-1',
  respondedAt: '2026-08-05T12:00:00.000Z',
  courtLabel: 'Doubles 1',
  outgoingPlayerName: 'Alex Ace',
  replacementPlayerName: 'Blair Ball',
  afterPlayers: ['Blair Ball', 'Casey Court'],
}

describe('Captain lineup confirmation closeout', () => {
  it('uses the accepted response as a stable one-time success id', () => {
    expect(buildCaptainLineupConfirmationId(change)).toBe(
      'message-1:2026-08-05T12:00:00.000Z:doubles-1:blair-ball',
    )
  })

  it('builds a short team-ready court confirmation', () => {
    expect(buildCaptainLineupConfirmationShareBody({
      change,
      matchDate: '2026-08-12',
      opponent: 'Net Results',
    })).toBe(
      'Doubles 1 confirmed for 2026-08-12 vs Net Results: Blair Ball is in for Alex Ace. Court: Blair Ball / Casey Court.',
    )
  })

  it('remembers the success once per signed-in captain and response', () => {
    const first = rememberCaptainLineupConfirmation([], {
      userId: 'captain-1',
      confirmationId: 'confirmation-1',
      seenAt: '2026-08-05T12:01:00.000Z',
    })
    const updated = rememberCaptainLineupConfirmation(first, {
      userId: 'captain-1',
      confirmationId: 'confirmation-1',
      seenAt: '2026-08-05T12:02:00.000Z',
    })
    expect(updated).toHaveLength(1)
    expect(hasSeenCaptainLineupConfirmation(updated, 'captain-1', 'confirmation-1')).toBe(true)
    expect(hasSeenCaptainLineupConfirmation(updated, 'captain-2', 'confirmation-1')).toBe(false)
  })
})
