import { describe, expect, it } from 'vitest'
import { buildPublicTeamEvidence, isDiscoverablePublicTeam, publicTiqRead, quotePublicTeamFilter, type PublicTeamMatchRow } from '../public-competition-evidence'
import { buildTeamProfileHref, decodeTeamRouteSegment } from '../team-routes'

const row = (id: string, changes: Partial<PublicTeamMatchRow> = {}): PublicTeamMatchRow => ({ id, match_date: '2026-10-05', home_team: 'Ace/Deuce', away_team: 'Court Crew', league_name: 'Local league', flight: '4.0', match_type: 'doubles', score: '6-4 6-3', winner_side: 'A', public_history_eligible: true, ...changes })

describe('public competition evidence', () => {
  it('does not turn team-tie scores, private records, or future scores into court evidence', () => {
    expect(buildPublicTeamEvidence([
      row('tie', { score: '3-2' }), row('private', { public_history_eligible: false }),
      row('future', { match_date: '2027-01-01' }), row('retired', { score: '6-4 RET' }),
      row('placeholder', { score: '1-0' }), row('bad-date', { match_date: '2026-02-31' }),
    ], '2026-10-10')).toEqual([])
  })
  it('excludes source headings, missing teams, and self-opposition', () => {
    expect(buildPublicTeamEvidence([row('heading', { home_team: 'Home team' }), row('missing', { away_team: null }), row('league', { home_team: 'Local league' }), row('same', { away_team: 'ace/deuce' })])).toEqual([])
  })
  it('preserves opposite court results and competition scope without asserting a team tie', () => {
    const results = buildPublicTeamEvidence([row('one')])
    expect(results.find((team) => team.name === 'Ace/Deuce')?.results[0]).toMatchObject({ result: 'W', opponent: 'Court Crew', league: 'Local league', flight: '4.0', format: 'doubles' })
    expect(results.find((team) => team.name === 'Court Crew')?.results[0].result).toBe('L')
    expect(isDiscoverablePublicTeam(results[0])).toBe(false)
  })
  it('deduplicates rows and only promotes teams with three scored court results', () => {
    const rows = [row('one'), row('two'), row('three')]
    const evidence = buildPublicTeamEvidence([...rows, rows[0]])
    expect(evidence[0].results).toHaveLength(3)
    expect(isDiscoverablePublicTeam(evidence[0])).toBe(true)
    expect(buildPublicTeamEvidence(Array.from({ length: 10 }, (_, i) => row(String(i))))[0].results).toHaveLength(6)
  })
  it('masks decimal precision and refuses missing or invalid rating signals', () => {
    expect(publicTiqRead(3.734)).toBe('3.XX')
    for (const value of [null, undefined, 0, NaN, Infinity, 7.1, '3.734']) expect(publicTiqRead(value)).toBeNull()
  })
  it('keeps slash-containing team names in one route segment and quotes filter delimiters', () => {
    expect(buildTeamProfileHref('Ace/Deuce')).toBe('/teams/Ace~2FDeuce')
    expect(decodeTeamRouteSegment('Ace~2FDeuce')).toBe('Ace/Deuce')
    expect(quotePublicTeamFilter('A, "B"')).toBe('"A, \\"B\\""')
  })
})
