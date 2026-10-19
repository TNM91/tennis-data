import { describe, expect, it } from 'vitest'
import { courtEntryIssue, isCourtEntryComplete, type ScorecardCourtEntry } from '../captain-scorecard-readiness'

const loss: ScorecardCourtEntry = {
  matchType: 'doubles', teamPlayers: ['David', 'Chris'], opponentPlayers: ['One', 'Two'],
  score: '4-6 5-5', outcome: 'opponent', resultType: 'played',
  timedSets: [{ setNumber: 2, decidedBy: 'tiebreak', winner: 'opponent' }],
  defaultKnownBeforeMatch: null, retiredPlayer: '', retirementReason: null, retirementKnownBeforeMatch: null,
}

describe('scorecard court readiness', () => {
  it('marks a tied timed-set loss ready without requiring another confirmation', () => {
    expect(courtEntryIssue(loss)).toBeNull()
    expect(isCourtEntryComplete(loss)).toBe(true)
  })

  it('immediately removes readiness when an edit makes the result incomplete', () => {
    expect(courtEntryIssue({ ...loss, opponentPlayers: ['One', ''] })).toBe('Enter each opponent’s name.')
    expect(isCourtEntryComplete({ ...loss, opponentPlayers: ['One', ''] })).toBe(false)
    expect(courtEntryIssue({ ...loss, teamPlayers: ['David'] })).toBe('Select each player on your team.')
    expect(courtEntryIssue({ ...loss, score: '' })).toBe('Enter the score.')
    expect(courtEntryIssue({ ...loss, outcome: 'team' })).toContain('court winner')
  })

  it('identifies an unset timed-set winner rather than silently disabling submission', () => {
    expect(courtEntryIssue({ ...loss, timedSets: [{ setNumber: 2, decidedBy: 'tiebreak', winner: '' }] })).toBe('Choose who won set 2.')
  })

  it('requires only one player per side for singles', () => {
    expect(isCourtEntryComplete({ ...loss, matchType: 'singles', teamPlayers: ['David'], opponentPlayers: ['One'] })).toBe(true)
  })

  it('keeps default and retirement requirements intact', () => {
    const defaulted = { ...loss, resultType: 'default' as const, teamPlayers: [], opponentPlayers: [], score: '', timedSets: undefined }
    expect(courtEntryIssue(defaulted)).toBe('Choose when the default was known.')
    expect(isCourtEntryComplete({ ...defaulted, defaultKnownBeforeMatch: false })).toBe(true)
    const retired = { ...loss, resultType: 'retired' as const, timedSets: undefined }
    expect(courtEntryIssue(retired)).toBe('Select the player who retired.')
    expect(courtEntryIssue({ ...retired, retiredPlayer: 'David' })).toBe('Choose why play stopped.')
    expect(courtEntryIssue({ ...retired, retiredPlayer: 'David', retirementReason: 'injury' })).toBe('Choose when the retirement issue became known.')
    expect(isCourtEntryComplete({ ...retired, retiredPlayer: 'David', retirementReason: 'injury', retirementKnownBeforeMatch: false })).toBe(true)
  })
})
