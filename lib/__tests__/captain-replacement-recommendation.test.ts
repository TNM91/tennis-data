import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildCaptainReplacementLineupHref,
  buildCaptainReplacementRecommendation,
  type CaptainReplacementPlayer,
} from '../captain-replacement-recommendation'

const roster: CaptainReplacementPlayer[] = [
  { id: 'alex', name: 'Alex Ace', appearances: 5, wins: 4, losses: 1, singlesDynamic: 4.2, doublesDynamic: 4.25, overallBase: 4, overallUstaDynamic: 4.22, ratingStatus: 'Trending Up' },
  { id: 'casey', name: 'Casey Court', appearances: 8, wins: 5, losses: 3, singlesDynamic: 4.32, doublesDynamic: 4.34, overallBase: 4, overallUstaDynamic: 4.31, ratingStatus: 'Holding' },
  { id: 'taylor', name: 'Taylor Topspin', appearances: 3, wins: 2, losses: 1, singlesDynamic: 4.56, doublesDynamic: 4.58, overallBase: 4.5, overallUstaDynamic: 4.55, ratingStatus: 'Holding' },
]

describe('Captain replacement recommendation', () => {
  it('prefers a confirmed available player and excludes assigned or uncertain players', () => {
    const result = buildCaptainReplacementRecommendation({
      unavailablePlayerName: 'Jordan Lee',
      lineupRow: { courtLabel: 'Doubles 1', slotType: 'doubles', players: ['Jordan Lee', 'Morgan Net'] },
      lineupRows: [{ courtLabel: 'Doubles 1', slotType: 'doubles', players: ['Jordan Lee', 'Morgan Net'] }],
      roster,
      availability: [
        { name: 'Alex Ace', status: 'available' },
        { name: 'Casey Court', status: 'maybe' },
        { name: 'Taylor Topspin', status: 'unknown' },
      ],
    })

    expect(result).toMatchObject({ playerName: 'Alex Ace', needsConfirmation: false, partnerName: 'Morgan Net' })
    expect(result?.reason).toContain('Confirmed In')
  })

  it('enforces exact Tri-Level court ratings', () => {
    const result = buildCaptainReplacementRecommendation({
      unavailablePlayerName: 'Jordan Lee',
      lineupRow: { courtLabel: '4.5 Doubles', slotType: 'doubles', players: ['Jordan Lee', 'Morgan Net'] },
      lineupRows: [{ courtLabel: '4.5 Doubles', slotType: 'doubles', players: ['Jordan Lee', 'Morgan Net'] }],
      roster,
      availability: [
        { name: 'Alex Ace', status: 'available' },
        { name: 'Taylor Topspin', status: 'available' },
      ],
    })

    expect(result).toMatchObject({ playerName: 'Taylor Topspin', ratingLevel: 4.5 })
  })

  it('uses doubles partner history as a tennis-specific tie breaker', () => {
    const result = buildCaptainReplacementRecommendation({
      unavailablePlayerName: 'Jordan Lee',
      lineupRow: { courtLabel: 'Doubles 2', slotType: 'doubles', players: ['Jordan Lee', 'Morgan Net'] },
      lineupRows: [{ courtLabel: 'Doubles 2', slotType: 'doubles', players: ['Jordan Lee', 'Morgan Net'] }],
      roster: [roster[0], { ...roster[1], doublesDynamic: 4.26, overallUstaDynamic: 4.24 }],
      availability: [
        { name: 'Alex Ace', status: 'available' },
        { name: 'Casey Court', status: 'available' },
      ],
      pairings: [{ names: ['Alex Ace', 'Morgan Net'], appearances: 4, wins: 4, losses: 0 }],
    })

    expect(result?.playerName).toBe('Alex Ace')
    expect(result?.reason).toContain('4 matches with Morgan Net')
  })

  it('labels an unconfirmed fallback as a player to ask first', () => {
    const result = buildCaptainReplacementRecommendation({
      unavailablePlayerName: 'Jordan Lee',
      lineupRow: { courtLabel: 'Singles 1', slotType: 'singles', players: ['Jordan Lee'] },
      lineupRows: [{ courtLabel: 'Singles 1', slotType: 'singles', players: ['Jordan Lee'] }],
      roster: [roster[0]],
      availability: [],
    })

    expect(result).toMatchObject({ playerName: 'Alex Ace', needsConfirmation: true })
    expect(result?.reason).toContain('Availability not confirmed')
  })

  it('preserves lineup scope in the suggested swap handoff', () => {
    const href = buildCaptainReplacementLineupHref('/captain/lineup-builder?team=Net+Results&date=2026-08-12', {
      outPlayer: 'Jordan Lee',
      replacementPlayer: 'Alex Ace',
      courtLabel: 'Doubles 1',
    })

    expect(href).toContain('team=Net+Results')
    expect(href).toContain('replace=Jordan+Lee')
    expect(href).toContain('replacement=Alex+Ace')
    expect(href).toContain('court=Doubles+1')
  })

  it('connects the Captain alert to the lineup-builder handoff', () => {
    const captainSource = readFileSync(join(process.cwd(), 'app/captain/page.tsx'), 'utf8')
    const builderSource = readFileSync(join(process.cwd(), 'app/captain/lineup-builder/page.tsx'), 'utf8')

    expect(captainSource).toContain('buildCaptainReplacementRecommendation({')
    expect(captainSource).toContain('Best replacement')
    expect(captainSource).toContain('Open suggested swap')
    expect(builderSource).toContain('Suggested availability change')
    expect(builderSource).toContain('No court was changed automatically.')
  })
})
