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
  it('keeps standings tables touch-scrollable without page overflow', () => {
    const scrollStyle = styleBlock('standingsTableScrollStyle')
    expect(scrollStyle).toContain("overflowX: 'auto'")
    expect(scrollStyle).toContain("overscrollBehaviorX: 'contain'")
    expect(scrollStyle).toContain("WebkitOverflowScrolling: 'touch'")
    expect(scrollStyle).toContain("scrollbarWidth: 'thin'")
    expect(scrollStyle).toContain("maxWidth: '100%'")
    expect(scrollStyle).toContain('minWidth: 0')
    expect(styleBlock('standingsTableStyle')).toContain("minWidth: 'min(100%, 620px)'")
  })
})
