import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/leagues/[league]/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('league detail table mobile layout guards', () => {
  it('uses League Office wording for the season workspace CTA', () => {
    expect(source).toContain('Open League Office')
    expect(source).not.toContain('Open Compete')
  })

  it('keeps standings tables touch-scrollable without page overflow', () => {
    const scrollStyle = styleBlock('standingsTableScrollStyle')
    expect(scrollStyle).toContain("overflowX: 'auto'")
    expect(scrollStyle).toContain("overscrollBehaviorX: 'contain'")
    expect(scrollStyle).toContain("WebkitOverflowScrolling: 'touch'")
    expect(scrollStyle).toContain("scrollbarWidth: 'thin'")
    expect(scrollStyle).toContain("maxWidth: '100%'")
    expect(scrollStyle).toContain('minWidth: 0')
    expect(styleBlock('standingsTableStyle')).toContain('minWidth: 0')
    expect(styleBlock('standingsTableStyle')).not.toContain("minWidth: 'min(100%, 620px)'")
  })

  it('keeps the team filter select labeled and visibly focused', () => {
    expect(source).toContain('<label htmlFor="teamFilter" style={inputLabel}>')
    expect(source).toContain('onFocus={() => setTeamFilterFocused(true)}')
    expect(source).toContain('onBlur={() => setTeamFilterFocused(false)}')
    expect(source).toContain('...(teamFilterFocused ? selectFocusStyle : null)')
    expect(source).toContain('const selectFocusStyle: CSSProperties')
    expect(styleBlock('selectStyle')).toContain("outline: '2px solid transparent'")
    expect(styleBlock('selectStyle')).toContain('outlineOffset: 2')
    expect(styleBlock('selectStyle')).not.toContain("outline: 'none'")
  })
})
