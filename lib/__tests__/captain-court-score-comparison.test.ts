import { describe, expect, it } from 'vitest'
import { courtScoreRecord } from '../captain-court-score-comparison'
import type { PlayerSetScoreMatch } from '../player-set-score-grid'

const match: PlayerSetScoreMatch = { id: 'shared', matchType: 'doubles', score: '7-6 6-1', result: 'W' }
describe('court set comparison', () => {
  it('counts a pair shared match once and excludes other partners', () => {
    const record = courtScoreRecord(['a', 'b'], { a: { setScoreMatches: [match, { ...match, id: 'other' }] }, b: { setScoreMatches: [match] } }, 'doubles')
    expect(record.scoredMatches).toBe(1)
    expect(record.totalSets).toBe(2)
    expect(record.close).toEqual({ wins: 1, losses: 0 })
    expect(record.decisive).toEqual({ wins: 1, losses: 0 })
  })
  it('excludes players facing each other and conflicting scores', () => {
    expect(courtScoreRecord(['a', 'b'], { a: { setScoreMatches: [match] }, b: { setScoreMatches: [{ ...match, result: 'L' }] } }, 'doubles').scoredMatches).toBe(0)
    expect(courtScoreRecord(['a', 'b'], { a: { setScoreMatches: [match] }, b: { setScoreMatches: [{ ...match, score: '6-0 6-0' }] } }, 'doubles').scoredMatches).toBe(0)
    expect(courtScoreRecord(['a', 'b'], { a: { setScoreMatches: [match] }, b: { setScoreMatches: [match, { ...match, result: 'L' }] } }, 'doubles').scoredMatches).toBe(0)
  })
  it('requires a complete court and separates disciplines', () => {
    expect(courtScoreRecord(['a', ''], { a: { setScoreMatches: [match] } }, 'doubles').complete).toBe(false)
    expect(courtScoreRecord(['a'], { a: { setScoreMatches: [match] } }, 'singles').scoredMatches).toBe(0)
  })
})
