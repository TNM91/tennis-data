import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const previewSource = readFileSync(join(process.cwd(), 'app/components/preview-homepage.tsx'), 'utf8')
const heroSource = readFileSync(join(process.cwd(), 'app/components/homepage-hero-responsive.tsx'), 'utf8')
const commandCenterSource = readFileSync(join(process.cwd(), 'app/components/public-command-center.tsx'), 'utf8')
const portalToolbarSource = readFileSync(join(process.cwd(), 'app/components/portal-tool-bar.tsx'), 'utf8')

function styleBlock(source: string, name: string) {
  const pattern = new RegExp(`const ${name}: CSSProperties = \\{([\\s\\S]*?)\\n\\}`)
  return source.match(pattern)?.[1] ?? ''
}

describe('Public home mobile layout guards', () => {
  it('keeps active homepage grids minmax-safe on mobile and tablet', () => {
    expect(previewSource).not.toContain("? '1fr'")
    expect(previewSource).not.toContain("whiteSpace: 'nowrap'")
    expect(previewSource).not.toMatch(/minmax\([0-9]+px/)
    expect(previewSource).toContain("isTablet ? 'minmax(0, 1fr)'")
    expect(previewSource).toMatch(/isMobile\s*\?\s*'minmax\(0, 1fr\)'/)
    expect(previewSource).toContain("isSmallMobile ? 'minmax(0, 1fr)'")
    expect(previewSource).toContain('minmax(min(100%, 360px), 0.96fr)')
    expect(previewSource).toContain('minmax(min(100%, 320px), 1.08fr)')
    expect(previewSource).toContain('overflowWrap: \'anywhere\'')
  })

  it('keeps preview homepage compact rows shrink-safe', () => {
    expect(previewSource).not.toContain("'auto minmax(min(100%, 132px), 160px) minmax(0, 1fr) auto'")
    expect(previewSource).not.toContain("'minmax(0, 1fr) auto'")
    expect(previewSource).not.toContain("'52px minmax(0, 1fr) auto auto'")
    expect(previewSource).not.toContain("'28px minmax(0, 1fr) auto auto'")
    expect(previewSource).not.toContain("'12px 1fr'")

    expect(previewSource).toContain("'minmax(0, auto) minmax(min(100%, 132px), 160px) minmax(0, 1fr) minmax(0, auto)'")
    expect(previewSource).toContain("'minmax(0, 52px) minmax(0, 1fr) minmax(0, auto) minmax(0, auto)'")
    expect(previewSource).toContain("'minmax(0, 28px) minmax(0, 1fr) minmax(0, auto) minmax(0, auto)'")
    expect(styleBlock(previewSource, 'captainSignalRowStyle')).toContain(
      "gridTemplateColumns: 'minmax(0, 1fr) minmax(0, auto)'",
    )
    expect(styleBlock(previewSource, 'bulletRowStyle')).toContain(
      "gridTemplateColumns: 'minmax(0, 12px) minmax(0, 1fr)'",
    )
  })

  it('keeps alternate hero component aligned with public home guards', () => {
    expect(heroSource).not.toContain("? '1fr'")
    expect(heroSource).toContain('Team Hub')
    expect(heroSource).not.toContain('Captain workspace')
    expect(heroSource).toContain("const heroGrid = isTablet ? 'minmax(0, 1fr)'")
    expect(heroSource).toContain("const statGrid = isMobile ? 'minmax(0, 1fr)'")
    expect(heroSource).toContain("const featureGrid = isMobile ? 'minmax(0, 1fr)'")
    expect(heroSource).toContain("gridTemplateColumns: isMobile ? 'minmax(0, 1fr)'")
    expect(heroSource).toContain('minWidth: 0')
  })

  it('keeps the active public command-center homepage mobile-safe', () => {
    expect(styleBlock(commandCenterSource, 'heroStyle')).toContain(
      "gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))'",
    )
    expect(styleBlock(commandCenterSource, 'heroCopyStyle')).toContain("boxSizing: 'border-box'")
    expect(styleBlock(commandCenterSource, 'heroPanelStyle')).toContain("boxSizing: 'border-box'")
    expect(styleBlock(commandCenterSource, 'heroTitleStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock(commandCenterSource, 'primaryButtonStyle')).toContain("whiteSpace: 'normal'")
  })

  it('keeps the persistent public portal toolbar from becoming a clipped mobile rail', () => {
    expect(portalToolbarSource).not.toContain("display: publicVisitor && isMobile ? 'flex' : 'grid'")
    expect(portalToolbarSource).not.toContain("overflowX: publicVisitor && isMobile ? 'auto' : undefined")
    expect(portalToolbarSource).not.toContain("flex: '0 0 154px'")
    expect(portalToolbarSource).toContain('screenWidth < 360')
    expect(portalToolbarSource).toContain("'repeat(2, minmax(0, 1fr))'")
    expect(portalToolbarSource).toContain("const compactMobileLaneCardStyle")
    expect(styleBlock(portalToolbarSource, 'compactMobileLaneCardStyle')).toContain("width: '100%'")
    expect(styleBlock(portalToolbarSource, 'compactMobileLaneCardStyle')).toContain("boxSizing: 'border-box'")
  })
})
