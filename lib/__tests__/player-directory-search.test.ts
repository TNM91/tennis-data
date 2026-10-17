import { describe, expect, it } from 'vitest'
import { playerDirectorySearchFilter } from '@/lib/player-directory-search'

describe('player directory database search', () => {
  it('searches both names and locations before the result limit', () => {
    expect(playerDirectorySearchFilter(' Nathan Meinert ')).toBe(
      'name.ilike."%Nathan Meinert%",location.ilike."%Nathan Meinert%"',
    )
  })

  it('keeps punctuation inside a quoted value and escapes wildcard characters', () => {
    const filter = playerDirectorySearchFilter('St. Louis, (MO)')
    expect(filter).toBe('name.ilike."%St. Louis, (MO)%",location.ilike."%St. Louis, (MO)%"')
    expect(playerDirectorySearchFilter('100%_')).toContain('100\\%\\_')
    expect(playerDirectorySearchFilter('A"B')).toContain('A\\"B')
  })
})
