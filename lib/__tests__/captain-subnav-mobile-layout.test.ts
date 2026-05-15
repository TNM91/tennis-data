import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/components/captain-subnav.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}:`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Captain subnav mobile layout guards', () => {
  it('keeps shared Captain navigation rows shrink-safe', () => {
    expect(styleBlock('gridStyle')).toContain('minWidth: 0')
    expect(styleBlock('linkStyle')).toContain("'minmax(0, 30px) minmax(0, 1fr) minmax(0, auto)'")
    expect(styleBlock('linkStyle')).toContain('minWidth: 0')
    expect(styleBlock('linkStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('secondaryGridStyle')).toContain('minWidth: 0')
    expect(styleBlock('secondaryLinkStyle')).toContain("'minmax(0, 1fr) minmax(0, auto)'")
    expect(source).not.toContain("'30px minmax(0, 1fr) auto'")
    expect(source).not.toContain("'minmax(0, 1fr) auto'")
  })
})
