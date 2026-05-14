import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/components/site-footer.tsx'), 'utf8')

describe('site footer mobile layout guards', () => {
  it('keeps footer grids and text containers mobile-safe', () => {
    expect(source).not.toContain("gridTemplateColumns: isTablet ? '1fr'")
    expect(source).not.toContain("gridTemplateColumns: isMobile ? '1fr'")
    expect(source).not.toContain("'1fr auto'")
    expect(source).not.toContain("'minmax(0, 1fr) auto'")
    expect(source).not.toContain("'auto minmax(0, 1fr)'")
    expect(source).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(source).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 8.5rem)'")
    expect(source).toContain("gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 2.125rem) minmax(0, 1fr)'")
    expect(source).toContain("maxWidth: '100%'")
    expect(source).toContain("const footerJourneyTextStyle")
    expect(source).toContain("const footerMetaLinkStyle")
    expect(source).toContain("overflowWrap: 'anywhere'")
    expect(source).toContain('minWidth: 0')
  })
})
