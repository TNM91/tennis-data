import { describe, expect, it } from 'vitest'
import { buildDirectoryPlayerHref, getPlayerDirectoryReturnHref } from '@/lib/player-directory-navigation'

describe('returning from a player profile', () => {
  it('preserves the search, combined filters, expanded results and selected player', () => {
    const href = buildDirectoryPlayerHref('player-12', '/explore/players?q=Nathan&filter=with-matches&flight=4.5%2B&sort=name&browse=1', true)
    const profile = new URL(href, 'https://www.tenaceiq.com')
    const back = getPlayerDirectoryReturnHref(profile.searchParams.get('returnTo'))
    const directory = new URL(back, profile.origin)
    expect(profile.pathname).toBe('/players/player-12')
    expect(Object.fromEntries(directory.searchParams)).toEqual({
      q: 'Nathan', filter: 'with-matches', flight: '4.5+', sort: 'name', browse: '1', show: 'all',
    })
    expect(directory.hash).toBe('#player-player-12')
  })

  it.each([null, 'https://example.com/players', '//example.com/players', '/login', '/players/another-player', '/\\example.com/players'])('rejects an unrelated return destination: %s', (destination) => {
    expect(getPlayerDirectoryReturnHref(destination)).toBe('/explore/players')
  })

  it('keeps legacy directory paths while dropping unknown parameters and anchors', () => {
    expect(getPlayerDirectoryReturnHref('/players?q=Alex&token=secret#unexpected')).toBe('/players?q=Alex')
  })
})
