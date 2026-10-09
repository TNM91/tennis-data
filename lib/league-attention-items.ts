import { buildTeamResultReviewHref } from './team-result-review-filter'
export type LeagueAttentionItem = { id: string; category: 'results' | 'approvals'; leagueName: string; title: string; detail: string; href: string; action: string }

export function buildLeagueAttentionItems(input: {
  teams: Array<{ id: string; name: string; missing: number; scoreReview: number; href: string }>
  approvals: Array<{ leagueId: string; leagueName: string; count: number }>
}): LeagueAttentionItem[] {
  return [
    ...input.teams.flatMap(league => {
      const items: LeagueAttentionItem[] = []
      if (league.scoreReview > 0) items.push({ id: `scores:${league.id}`, category: 'results', leagueName: league.name, title: `${league.scoreReview} ${league.scoreReview === 1 ? 'match needs' : 'matches need'} score review`, detail: 'Check the recorded score and winner before relying on dynamic points.', href: buildTeamResultReviewHref(league.href, 'score_review'), action: 'Review scores' })
      if (league.missing > 0) items.push({ id: `lines:${league.id}`, category: 'results', leagueName: league.name, title: `${league.missing} ${league.missing === 1 ? 'match has' : 'matches have'} incomplete lines`, detail: 'Add missing court results or finish incomplete match lines.', href: buildTeamResultReviewHref(league.href, 'incomplete'), action: 'Finish match lines' })
      return items
    }),
    ...input.approvals.filter(league => league.count > 0).map((league): LeagueAttentionItem => ({ id: `approvals:${league.leagueId}`, category: 'approvals', leagueName: league.leagueName, title: `${league.count} join request${league.count === 1 ? '' : 's'} waiting`, detail: 'Approve participants or request the information you need.', href: '#league-registry', action: 'Review requests' })),
  ]
}
