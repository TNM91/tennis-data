import { describe, expect, it } from 'vitest'
import {
  buildCaptainLineupConfirmationId,
  buildCaptainLineupConfirmationNextStep,
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

  it('hands the captain directly to the next court that needs a decision', () => {
    expect(buildCaptainLineupConfirmationNextStep({
      nextCourt: { label: '4.0 Doubles', status: 'needs_captain' },
      nextTask: { label: 'Message team', detail: 'Send the plan.', cta: 'Open messages' },
      confirmedCount: 1,
      totalCount: 3,
    })).toEqual({
      kind: 'court',
      eyebrow: 'Next court',
      title: '4.0 Doubles',
      detail: '4.0 Doubles needs your decision.',
      cta: 'Open next court',
    })
  })

  it('moves to the next match task when every court is confirmed', () => {
    expect(buildCaptainLineupConfirmationNextStep({
      nextCourt: null,
      nextTask: { label: 'Message team', detail: 'Send the final plan.', cta: 'Open messages' },
      confirmedCount: 3,
      totalCount: 3,
    })).toEqual({
      kind: 'task',
      eyebrow: 'Courts ready',
      title: 'Message team',
      detail: 'Send the final plan.',
      cta: 'Open messages',
    })
  })

  it('closes into Team Chat when no unresolved court or match task remains', () => {
    expect(buildCaptainLineupConfirmationNextStep({
      nextCourt: null,
      nextTask: null,
      confirmedCount: 3,
      totalCount: 3,
    })).toEqual({
      kind: 'complete',
      eyebrow: 'Lineup ready',
      title: 'All 3 courts confirmed',
      detail: 'Open Team Chat if the team needs an update.',
      cta: 'Open Team Chat',
    })
  })
})
