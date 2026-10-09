import type { MatchLineSummary } from './team-match-line-summary'

export type TeamResultCompletionFilter = 'all' | 'complete' | 'incomplete' | 'score_review'
export function readTeamResultReviewFilter(value: string | null): TeamResultCompletionFilter {
  return value === 'complete' || value === 'incomplete' || value === 'score_review' ? value : 'all'
}
export function buildTeamResultReviewHref(href: string, filter: TeamResultCompletionFilter) {
  const url = new URL(href, 'https://tenaceiq.local')
  if (filter === 'all') url.searchParams.delete('status'); else url.searchParams.set('status', filter)
  return url.pathname + url.search + url.hash
}
export function matchesTeamResultReviewFilter(filter: TeamResultCompletionFilter, summary: MatchLineSummary | undefined, scoringSystem: string | undefined) {
  const complete = Boolean(summary && summary.total > 0 && summary.completed === summary.total)
  if (filter === 'complete') return complete
  if (filter === 'incomplete') return !complete
  // Keep unavailable checks visible so the user sees Not checked rather than a false empty queue.
  if (filter === 'score_review') return scoringSystem === 'dynamic_points' && (!summary || summary.scoreReview > 0)
  return true
}
