import { describe, expect, it } from 'vitest'
import {
  buildCaptainLockedLineupAnnouncement,
  buildCaptainLockedLineupId,
  buildCaptainLineupConfirmationId,
  buildCaptainLineupConfirmationNextStep,
  buildCaptainLineupConfirmationShareBody,
  hasSeenCaptainLineupConfirmation,
  isCaptainLineupLocked,
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

const lockedLineup = [
  { label: '3.5 Doubles', players: ['Alex Ace', 'Blair Ball'] },
  { label: '4.0 Doubles', players: ['Casey Court', 'Drew Deuce'] },
  { label: '4.5 Doubles', players: ['Emery Edge', 'Frankie Forehand'] },
]

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

  it('recognizes and fingerprints a fully confirmed lineup', () => {
    expect(isCaptainLineupLocked({ confirmedCount: 3, totalCount: 3, lineup: lockedLineup })).toBe(true)
    expect(isCaptainLineupLocked({ confirmedCount: 2, totalCount: 3, lineup: lockedLineup })).toBe(false)
    expect(buildCaptainLockedLineupId({ messageId: 'message-1', lineup: lockedLineup }))
      .toMatch(/^lineup-locked:message-1:[a-z0-9]+$/)
  })

  it('builds one final team announcement with every court and match detail', () => {
    expect(buildCaptainLockedLineupAnnouncement({
      lineup: lockedLineup,
      matchDate: '2026-08-12',
      opponent: 'Net Results',
      arrivalTime: '6:00 PM',
      facility: 'Riverside Tennis Center',
    })).toBe([
      'Lineup locked — 2026-08-12 vs Net Results',
      '3.5 Doubles: Alex Ace / Blair Ball',
      '4.0 Doubles: Casey Court / Drew Deuce',
      '4.5 Doubles: Emery Edge / Frankie Forehand',
      'Arrive by 6:00 PM at Riverside Tennis Center.',
    ].join('\n'))
  })

  it('clearly marks missing match logistics', () => {
    expect(buildCaptainLockedLineupAnnouncement({
      lineup: lockedLineup,
      matchDate: '2026-08-12',
      opponent: 'Net Results',
      arrivalTime: 'Add arrival',
      facility: 'Add location',
    })).toContain('Match time and location: TBD.')
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

  it('moves to the next match task when courts are not fully confirmed', () => {
    expect(buildCaptainLineupConfirmationNextStep({
      nextCourt: null,
      nextTask: { label: 'Message team', detail: 'Send the final plan.', cta: 'Open messages' },
      confirmedCount: 2,
      totalCount: 3,
    })).toEqual({
      kind: 'task',
      eyebrow: 'Next match task',
      title: 'Message team',
      detail: 'Send the final plan.',
      cta: 'Open messages',
    })
  })

  it('creates the lineup-locked send when every court is confirmed', () => {
    expect(buildCaptainLineupConfirmationNextStep({
      nextCourt: null,
      nextTask: null,
      confirmedCount: 3,
      totalCount: 3,
    })).toEqual({
      kind: 'locked',
      eyebrow: 'Lineup locked',
      title: 'All 3 courts confirmed',
      detail: 'Send the full lineup and match details to the team.',
      cta: 'Send final lineup',
    })
  })
})
