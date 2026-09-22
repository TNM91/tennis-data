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
    expect(source).toContain("gridTemplateColumns: 'minmax(0, 1fr)'")
    expect(source).toContain("gridTemplateColumns: isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))'")
    expect(source).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 8.5rem)'")
    expect(source).toContain('const showFooterNav = !isMobile && !useRailFooter')
    expect(source).toContain('const footerYear = new Date().getFullYear()')
    expect(source).toContain('? `\\u00A9 ${footerYear} TenAceIQ.`')
    expect(source).toContain('data-site-footer-content="true"')
    expect(source).toContain('{showFooterNav ? (')
    expect(source).toContain('{useRailFooter ? (')
    expect(source).toContain('const railFooterCopyrightStyle')
    expect(source).toContain("maxWidth: '100%'")
    expect(source).toContain("const footerNavLinkStyle")
    expect(source).toContain("const footerMetaLinkStyle")
    expect(source).toContain("const backToTopStyle")
    expect(source).toContain("overflowWrap: 'anywhere'")
    expect(source).toContain('minWidth: 0')
  })
})
