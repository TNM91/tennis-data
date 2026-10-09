import { describe, expect, it } from 'vitest'
import { summarizeTeamMatchLines } from '../team-match-line-summary'

describe('team result score review summaries', () => {
  it('flags invalid scored lines while preserving wins and pending line coverage', () => {
    const result = summarizeTeamMatchLines(['review', 'pending', 'empty'], [
      { event_id: 'review', winner_side: 'A', score: 'invalid QA score' },
      { event_id: 'pending', winner_side: null, score: '' },
      { event_id: 'unrelated', winner_side: 'B', score: 'invalid' },
    ])
    expect(result.get('review')).toMatchObject({ total: 1, completed: 1, teamAWins: 1, scoreReview: 1, teamAPoints: 0 })
    expect(result.get('pending')).toMatchObject({ total: 1, completed: 0, scoreReview: 0 })
    expect(result.get('empty')).toMatchObject({ total: 0, scoreReview: 0 })
    expect(result.has('unrelated')).toBe(false)
  })
  it('clears score review after correction and retains calculated points', () => {
    const summary = summarizeTeamMatchLines(['match'], [{ event_id: 'match', winner_side: 'B', score: '4-6, 4-6' }]).get('match')!
    expect(summary.scoreReview).toBe(0); expect(summary.completed).toBe(1); expect(summary.teamBWins).toBe(1); expect(summary.teamBPoints).toBeGreaterThan(summary.teamAPoints)
  })
})
