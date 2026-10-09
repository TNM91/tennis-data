import { describe, expect, it } from 'vitest'
import { buildTeamResultReviewHref, matchesTeamResultReviewFilter, readTeamResultReviewFilter } from '../team-result-review-filter'
const summary = { total: 1, completed: 1, teamAWins: 1, teamBWins: 0, teamAPoints: 0, teamBPoints: 0, scoreReview: 1 }
describe('team result attention filters', () => {
  it('preserves league scope and fragment while changing or clearing status', () => {
    const href = buildTeamResultReviewHref('/league-coordinator/results?leagueId=fall&status=all#team-match-review', 'score_review')
    const url = new URL(href, 'https://test.local'); expect(url.searchParams.get('leagueId')).toBe('fall'); expect(url.searchParams.get('status')).toBe('score_review'); expect(url.hash).toBe('#team-match-review')
    expect(buildTeamResultReviewHref(href, 'all')).toBe('/league-coordinator/results?leagueId=fall#team-match-review')
    expect(readTeamResultReviewFilter('unknown')).toBe('all'); expect(readTeamResultReviewFilter('score_review')).toBe('score_review')
  })
  it('shows flagged dynamic scores and unknown checks while excluding clear and standard matches', () => {
    expect(matchesTeamResultReviewFilter('score_review', summary, 'dynamic_points')).toBe(true)
    expect(matchesTeamResultReviewFilter('score_review', { ...summary, scoreReview: 0 }, 'dynamic_points')).toBe(false)
    expect(matchesTeamResultReviewFilter('score_review', undefined, 'dynamic_points')).toBe(true)
    expect(matchesTeamResultReviewFilter('score_review', summary, 'standard')).toBe(false)
  })
  it('retains completion semantics for pending and empty records', () => {
    expect(matchesTeamResultReviewFilter('complete', summary, 'standard')).toBe(true)
    expect(matchesTeamResultReviewFilter('incomplete', summary, 'standard')).toBe(false)
    expect(matchesTeamResultReviewFilter('incomplete', { ...summary, completed: 0 }, 'standard')).toBe(true)
    expect(matchesTeamResultReviewFilter('incomplete', undefined, 'standard')).toBe(true)
    expect(matchesTeamResultReviewFilter('all', undefined, undefined)).toBe(true)
  })
})
