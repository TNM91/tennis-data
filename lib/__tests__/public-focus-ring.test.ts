import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sources = {
  globals: readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8'),
  coach: readFileSync(join(process.cwd(), 'app/coach/page.tsx'), 'utf8'),
  upgrade: readFileSync(join(process.cwd(), 'app/upgrade/page.tsx'), 'utf8'),
  search: readFileSync(join(process.cwd(), 'app/explore/search/page.tsx'), 'utf8'),
  leagues: readFileSync(join(process.cwd(), 'app/explore/leagues/page.tsx'), 'utf8'),
}

describe('public focus rings', () => {
  it('provides a shared focus-visible class that can beat inline control styles', () => {
    expect(sources.globals).toContain('.tiq-focus-ring')
    expect(sources.globals).toContain('.tiq-focus-ring:focus-visible')
    expect(sources.globals).toContain('outline: 2px solid rgba(155, 225, 29, 0.72) !important')
    expect(sources.globals).toContain('outline: 2px solid transparent')
    expect(sources.globals).not.toContain('outline: none;')
  })

  it('keeps the remaining public form controls on visible focus treatment', () => {
    for (const source of [sources.coach, sources.upgrade, sources.search, sources.leagues]) {
      expect(source).toContain('className="tiq-focus-ring"')
      expect(source).toContain("outline: '2px solid transparent'")
      expect(source).not.toContain("outline: 'none'")
    }
  })
})
