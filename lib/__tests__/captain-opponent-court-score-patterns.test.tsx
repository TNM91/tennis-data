import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { buildOpponentCourtScorePatterns } from '../captain-opponent-court-score-patterns'
import { buildPlayerSetScoreGrid } from '../player-set-score-grid'
import type { OpponentScoutCourt, OpponentScoutFixture, OpponentSeasonScout } from '../captain-opponent-season-scout'
import CaptainOpponentCourtScorePatterns from '@/app/components/captain-opponent-court-score-patterns'
import PlayerSetScoreGrid from '@/app/components/player-set-score-grid'

const court: OpponentScoutCourt = { key: 'd1', label: 'Doubles 1', slotIndex: 0, slotType: 'doubles', playerIds: ['a', 'b'], playerNames: ['Alex', 'Blake'], result: 'W', score: '7-6 6-1', scoreOriented: true, gamesFor: 13, gamesAgainst: 7, defaulted: false, needsReview: false }
const fixture = (day: number, courts: OpponentScoutCourt[] = [court]): OpponentScoutFixture => ({ key: String(day), date: `2026-09-${String(day).padStart(2, '0')}`, opponent: 'Rivals', courts, wins: 1, losses: 0, unknown: 0, expectedCourts: 1 })
const scout = (fixtures: OpponentScoutFixture[]): OpponentSeasonScout => ({ ready: true, lines: [], fixtures })

describe('opponent court score patterns', () => {
  it('defaults to the latest pair, counts their matches once and keeps all-partner views separate', () => {
    const source = scout([fixture(1, [{ ...court, slotIndex: 1 }]), fixture(3, [{ ...court, playerIds: ['b', 'a'], playerNames: ['Blake', 'Alex'] }]), fixture(2, [{ ...court, playerIds: ['a', 'c'], playerNames: ['Alex', 'Casey'], result: 'L', score: '4-6 1-6' }])])
    const before = JSON.stringify(source)
    const patterns = buildOpponentCourtScorePatterns(source, 0, 'doubles')
    expect(patterns[0]).toMatchObject({ scope: 'pair', name: 'Blake / Alex' })
    expect(patterns.filter((pattern) => pattern.scope === 'pair')).toHaveLength(2)
    expect(buildPlayerSetScoreGrid(patterns[0].matches, 'doubles')).toMatchObject({ scoredMatches: 2, totalSets: 4 })
    expect(patterns.find((pattern) => pattern.id === 'player:a')?.matches).toHaveLength(3)
    expect(JSON.stringify(source)).toBe(before)
  })

  it('chooses occupants from only the last four weeks but includes their older season scores', () => {
    const source = scout([fixture(1, [{ ...court, playerIds: ['old', 'other'] }]), fixture(2), fixture(3), fixture(4), fixture(5), fixture(6)])
    const patterns = buildOpponentCourtScorePatterns(source, 0, 'doubles')
    expect(patterns.some((pattern) => pattern.id === 'player:old')).toBe(false)
    expect(patterns[0].matches).toHaveLength(5)
  })

  it('keeps singles separate and excludes defaulted, conflicting and incomplete linked score samples', () => {
    const singles = { ...court, slotType: 'singles' as const, playerIds: ['a'], playerNames: ['Alex'] }
    const source = scout([fixture(6, [singles]), fixture(5), fixture(4, [{ ...singles, defaulted: true }]), fixture(3, [{ ...singles, needsReview: true }]), fixture(2, [{ ...singles, playerIds: [] }])])
    const patterns = buildOpponentCourtScorePatterns(source, 0, 'singles')
    expect(patterns).toHaveLength(1)
    expect(patterns[0]).toMatchObject({ scope: 'singles', name: 'Alex' })
    expect(patterns[0].matches).toHaveLength(1)
  })

  it.each([{ defaulted: true }, { needsReview: true }, { playerIds: ['a'] }, { playerIds: ['a', 'a'] }, { playerIds: ['a', ''] }])('does not offer unusable doubles occupants %j', (override) => {
    expect(buildOpponentCourtScorePatterns(scout([fixture(1, [{ ...court, ...override }])]), 0, 'doubles')).toEqual([])
  })

  it('rejects duplicate court occupants and unready scouting', () => {
    expect(buildOpponentCourtScorePatterns(scout([fixture(1, [court, court])]), 0, 'doubles')).toEqual([])
    expect(buildOpponentCourtScorePatterns({ ...scout([fixture(1)]), ready: false }, 0, 'doubles')).toEqual([])
  })

  it('leaves unknown and partial results out of counted sets', () => {
    const patterns = buildOpponentCourtScorePatterns(scout([fixture(1, [{ ...court, result: null }]), fixture(2, [{ ...court, score: '6-4 2-1 RET' }])]), 0, 'doubles')
    expect(buildPlayerSetScoreGrid(patterns[0].matches, 'doubles')).toMatchObject({ scoredMatches: 0, totalSets: 0, excludedMatches: 2 })
  })

  it('keeps the court panel closed and labels pair-only history accurately', () => {
    const html = renderToStaticMarkup(createElement(CaptainOpponentCourtScorePatterns, { scout: scout([fixture(1)]), slotIndex: 0, mode: 'doubles', courtLabel: 'Doubles 1' }))
    expect(html).not.toContain(' open=""')
    expect(html).toContain('Alex / Blake · together')
    expect(html).toContain('Alex · all partners')
    expect(html).toContain('Doubles · this pair together')
    expect(html).toContain('Only matches played together by this pair.')
    expect(html).not.toContain('Doubles combines every recorded partner.')
  })

  it('keeps existing standalone player grids switchable', () => {
    const html = renderToStaticMarkup(createElement(PlayerSetScoreGrid, { playerName: 'Alex', matches: [] }))
    expect(html).toContain('set-score discipline')
    expect(html).toContain('Doubles · all partners')
  })
})
