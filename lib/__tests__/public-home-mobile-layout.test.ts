import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const previewSource = readFileSync(join(process.cwd(), 'app/components/preview-homepage.tsx'), 'utf8')
const heroSource = readFileSync(join(process.cwd(), 'app/components/homepage-hero-responsive.tsx'), 'utf8')

describe('Public home mobile layout guards', () => {
  it('keeps active homepage grids minmax-safe on mobile and tablet', () => {
    expect(previewSource).not.toContain("? '1fr'")
    expect(previewSource).not.toContain("whiteSpace: 'nowrap'")
    expect(previewSource).not.toMatch(/minmax\([0-9]+px/)
    expect(previewSource).toContain("isTablet ? 'minmax(0, 1fr)'")
    expect(previewSource).toContain("isMobile ? 'minmax(0, 1fr)'")
    expect(previewSource).toContain("isSmallMobile ? 'minmax(0, 1fr)'")
    expect(previewSource).toContain('minmax(min(100%, 360px), 0.96fr)')
    expect(previewSource).toContain('minmax(min(100%, 320px), 1.08fr)')
    expect(previewSource).toContain('overflowWrap: \'anywhere\'')
  })

  it('keeps alternate hero component aligned with public home guards', () => {
    expect(heroSource).not.toContain("? '1fr'")
    expect(heroSource).toContain("const heroGrid = isTablet ? 'minmax(0, 1fr)'")
    expect(heroSource).toContain("const statGrid = isMobile ? 'minmax(0, 1fr)'")
    expect(heroSource).toContain("const featureGrid = isMobile ? 'minmax(0, 1fr)'")
    expect(heroSource).toContain("gridTemplateColumns: isMobile ? 'minmax(0, 1fr)'")
    expect(heroSource).toContain('minWidth: 0')
  })
})
