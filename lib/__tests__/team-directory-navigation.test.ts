import { describe, expect, it } from 'vitest'
import { getTeamDirectoryReturnHref } from '@/lib/team-directory-navigation'

describe('team directory return navigation', () => {
  it('preserves the search, scope, sorting and expanded results', () => {
    const query = new URLSearchParams({ q: 'Meinert', league: '2027 Adult 18 & Over Fall', flight: 'Men 4.5 (F)', season: '2027', sort: 'team', browse: '1', show: 'all' })
    expect(getTeamDirectoryReturnHref(`/explore/teams?${query}`)).toBe(`/explore/teams?${query}`)
  })
  it('keeps legacy directory paths and drops unknown parameters and fragments', () => {
    expect(getTeamDirectoryReturnHref('/teams?q=Meinert&token=secret#other')).toBe('/teams?q=Meinert')
  })
  it.each([null, 'https://example.com/teams', '//example.com/teams', '/login', '/teams/other', '/\\example.com/teams'])('rejects unrelated destinations: %s', (value) => {
    expect(getTeamDirectoryReturnHref(value)).toBe('/explore/teams')
  })
})
