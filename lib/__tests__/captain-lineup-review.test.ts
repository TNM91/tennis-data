import { describe, expect, it } from 'vitest'
import {
  buildCaptainLineupReviewReturnText,
  buildCaptainLineupReviewText,
  captainLineupReviewPath,
  captainLineupReviewReturnPath,
  countCaptainLineupReviewChanges,
  resolveCaptainLineupReviewToken,
  sanitizeCaptainLineupReviewRoster,
  sanitizeCaptainLineupReviewSlots,
  validateCaptainLineupReviewProposal,
} from '@/lib/captain-lineup-review'

const token = '48d192b1-032d-40f0-92c9-5d39fba35c65'
const roster = [
  { id: 'player-1', name: 'Nathan Meinert' },
  { id: 'player-2', name: 'Sam Edwards' },
  { id: 'player-3', name: 'Michael Ho' },
]
const slots = [
  {
    id: '4.0-doubles',
    label: '4.0 Doubles',
    slotType: 'doubles' as const,
    players: [
      { playerId: 'player-1', playerName: 'Nathan Meinert' },
      { playerId: 'player-2', playerName: 'Sam Edwards' },
    ],
  },
]

describe('captain lineup co-captain review', () => {
  it('uses compact lossless review and return links', () => {
    expect(captainLineupReviewPath(token)).toMatch(/^\/r\/[A-Za-z0-9_-]{22}$/)
    expect(captainLineupReviewReturnPath(token)).toMatch(/^\/p\/[A-Za-z0-9_-]{22}$/)
    expect(resolveCaptainLineupReviewToken(captainLineupReviewPath(token).split('/').pop() || '')).toBe(token)
  })

  it('sanitizes roster and lineup snapshots to the small public DTO', () => {
    expect(sanitizeCaptainLineupReviewRoster([
      { id: 'player-1', name: ' Nathan Meinert ', phone: 'private' },
      { id: 'player-1', name: 'Duplicate' },
    ])).toEqual([{ id: 'player-1', name: 'Nathan Meinert' }])
    expect(sanitizeCaptainLineupReviewSlots([{ ...slots[0], rating: 4.4 }])).toEqual(slots)
  })

  it('accepts roster swaps while rejecting duplicates and unknown names', () => {
    const swap = [{ ...slots[0], players: [slots[0].players[0], { playerId: 'player-3', playerName: 'Michael Ho' }] }]
    expect(validateCaptainLineupReviewProposal(slots, roster, swap)).toEqual(swap)
    expect(countCaptainLineupReviewChanges(slots, swap)).toBe(1)
    expect(validateCaptainLineupReviewProposal(slots, roster, [{ ...slots[0], players: [roster[0], roster[0]].map((player) => ({ playerId: player.id, playerName: player.name })) }])).toBeNull()
    expect(validateCaptainLineupReviewProposal(slots, roster, [{ ...slots[0], players: [slots[0].players[0], { playerId: 'x', playerName: 'Unknown' }] }])).toBeNull()
  })

  it('explains that the shared copy cannot change the captain lineup', () => {
    const invite = buildCaptainLineupReviewText({ teamName: 'Aces', opponentTeam: 'Topspin', dateText: 'Sep 14', reviewUrl: 'https://tenaceiq.com/r/short' })
    expect(invite).toContain('separate proposal')
    expect(invite).toContain('will not change my lineup')
    expect(invite).toContain('https://tenaceiq.com/r/short')

    const returned = buildCaptainLineupReviewReturnText({ reviewerName: 'Sam', teamName: 'Aces', opponentTeam: 'Topspin', captainUrl: 'https://tenaceiq.com/p/short', changedCourts: 1 })
    expect(returned).toContain('Sam reviewed')
    expect(returned).toContain('1 court changed')
    expect(returned).toContain('https://tenaceiq.com/p/short')
  })
})
