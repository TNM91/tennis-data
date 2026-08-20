import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')
const universalSearch = read('app/components/universal-search.tsx')
const exploreSearch = read('app/explore/search/page.tsx')
const exploreHome = read('app/explore/page.tsx')

describe('free Explore search', () => {
  it('sends an unmatched home or Explore query into the free player search path', () => {
    expect(universalSearch).toContain('buildFreePlayerSearchHref(q)')
    expect(universalSearch).toContain('`/explore/search?scope=players&q=${encodeURIComponent(query.trim())}`')
  })

  it('queries player names and locations in the database instead of filtering a fixed alphabetized slice', () => {
    expect(exploreSearch).toContain(".ilike('name', pattern)")
    expect(exploreSearch).toContain(".ilike('location', pattern)")
    expect(exploreSearch).not.toContain(".limit(250)")
  })

  it('keeps Explore free while giving searchers a clear plan comparison path', () => {
    expect(exploreHome).toContain('Explore stays free')
    expect(exploreHome).toContain('PRODUCT_UPGRADE_MESSAGE')
    expect(exploreHome).toContain('Compare plans')
  })
})
