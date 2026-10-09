import { describe, expect, it } from 'vitest'
import { buildLeagueAttentionItems } from '@/lib/league-attention-items'

describe('league attention actions', () => {
  it('keeps incomplete matches and score reviews distinct and sends both to the scoped result book', () => {
    const items = buildLeagueAttentionItems({ teams: [{ id: 'fall', name: 'Fall doubles', missing: 2, scoreReview: 1, href: '/league-coordinator/results?leagueId=fall' }], approvals: [] })
    expect(items).toHaveLength(2)
    expect(items[0].title).toBe('1 match needs score review')
    expect(items[1].title).toBe('2 matches have incomplete lines')
    expect(new Set(items.map(item => item.id)).size).toBe(2)
    expect(items.map(item => new URL(item.href, 'https://test.local').searchParams.get('leagueId'))).toEqual(['fall', 'fall'])
    expect(items.map(item => new URL(item.href, 'https://test.local').searchParams.get('status'))).toEqual(['score_review', 'incomplete'])
  })
  it('does not fabricate missing matches for an empty result book', () => {
    expect(buildLeagueAttentionItems({ teams: [{ id: 'new', name: 'New league', missing: 0, scoreReview: 0, href: '/results' }], approvals: [{ leagueId: 'new', leagueName: 'New league', count: 0 }] })).toEqual([])
  })
  it('groups approvals by season without presenting them as result disputes', () => {
    const items = buildLeagueAttentionItems({ teams: [], approvals: [{ leagueId: 'fall', leagueName: 'Fall', count: 3 }, { leagueId: 'winter', leagueName: 'Winter', count: 1 }] })
    expect(items.map(item => item.title)).toEqual(['3 join requests waiting', '1 join request waiting'])
    expect(items.every(item => item.category === 'approvals' && item.href === '#league-registry')).toBe(true)
  })
})
