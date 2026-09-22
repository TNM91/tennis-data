import { describe, expect, it } from 'vitest'
import { seasonGroupMessage, seasonGroupPath } from '@/lib/season-group-request'

const scope = { team: 'Aces / Friends', league: 'Fall 2027', flight: '4.0', seasonKey: '["2027","Fall 2027","4.0"]' }
const match = { id: 'fixture-1', home_team: scope.team, away_team: 'Volleys', match_date: '2026-09-14', match_time: '18:30:00' }
describe('group season request copy', () => {
  it('shares scope and fixture without any personal token or player identity', () => {
    const url = new URL(seasonGroupPath(scope, match.id), 'https://example.test')
    expect(url.pathname).toBe('/team-availability')
    expect(Object.fromEntries(url.searchParams)).toEqual({ ...scope, match: match.id })
    expect(url.hash).toBe('')
  })
  it('leads with the requested match and optional deadline without implying a final lineup', () => {
    const copy = seasonGroupMessage(scope, 'https://example.test/team-availability', match, 'Wednesday evening')
    expect(copy).toContain('vs Volleys')
    expect(copy).toContain('6:30 PM')
    expect(copy).toContain('by Wednesday evening')
    expect(copy).toContain('Sign in to answer for yourself')
    expect(copy).toContain('other season dates')
    expect(copy).toContain('Apple, Google, or your TiQ calendar')
    expect(copy).toContain('final lineup follows separately')
    expect(copy).not.toContain('No TiQ login')
  })
  it('supports a whole-season request with no invented match or deadline', () => {
    expect(seasonGroupMessage(scope, 'link')).toContain(`upcoming ${scope.team} season matches`)
    expect(seasonGroupPath(scope)).not.toContain('match=')
  })
})
