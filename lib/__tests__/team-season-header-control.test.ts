import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/teams/[team]/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}:`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Team season header control', () => {
  it('puts the season scope at the top of the team profile and makes the active view explicit', () => {
    expect(source).toContain('aria-label="Team season view"')
    expect(source).toContain('Season view')
    expect(source).toContain("{seasonFilter === 'all' ? 'Lifetime team view' : `${seasonFilter} roster and results`}")
    expect(source).toContain('aria-pressed={active}')
    expect(source.indexOf('aria-label="Team season view"')).toBeLessThan(source.indexOf('<div style={dynamicHeroActions}>'))
  })

  it('keeps the header season controls safe on small screens', () => {
    expect(styleBlock('teamSeasonScopeStyle')).toContain('minWidth: 0')
    expect(styleBlock('teamSeasonScopeControlsStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('teamSeasonScopeControlsStyle')).toContain('minWidth: 0')
    expect(styleBlock('teamSeasonScopeDetailStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('teamSeasonScopeButtonActiveStyle')).toContain('var(--brand-green)')
  })
})
