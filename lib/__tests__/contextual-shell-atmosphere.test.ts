import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const shellSource = readFileSync(join(process.cwd(), 'app/components/site-shell.tsx'), 'utf8')
const clubStyles = readFileSync(join(process.cwd(), 'app/components/club-workspace.module.css'), 'utf8').replace(/\r\n/g, '\n')

describe('contextual shell atmosphere', () => {
  it('renders one atmosphere layer instead of stacking generic and contextual artwork', () => {
    expect(shellSource).toContain("getContextualAtmosphereVisual(visualArea, pathname)")
    expect(shellSource).toMatch(/contextualAtmosphereVisual \? \([\s\S]*?<ContextualTennisVisual[\s\S]*?\) : \([\s\S]*?<div className=\{atmosphereClassName\}/)
  })

  it('uses page-specific visuals for hubs that do not need court positioning', () => {
    expect(shellSource).toContain("if (visualArea === 'compete') return 'compete'")
    expect(shellSource).toContain("if (visualArea === 'tournament') return 'tournament'")
    expect(shellSource).toContain("if (visualArea === 'captain') return 'captain'")
    expect(shellSource).toContain("if (visualArea === 'coach') return 'coach'")
    expect(shellSource).toContain("if (visualArea === 'league') return 'league'")
  })

  it('reserves the strategy court atmosphere for matchup analysis', () => {
    expect(shellSource).toContain("const strategyPrefixes = ['/matchup']")
    expect(shellSource).toContain("if (pathname === '/matchup' || pathname.startsWith('/matchup/')) return null")
  })

  it('keeps resources and tournaments to one restrained page-specific motif', () => {
    const visualStyles = readFileSync(join(process.cwd(), 'app/components/contextual-tennis-visual.module.css'), 'utf8').replace(/\r\n/g, '\n')

    expect(shellSource).toContain("const suppressShellAtmosphere = pathname === '/resources' || pathname === '/tournaments'")
    expect(shellSource).toContain('!suppressShellAtmosphere ? (')
    expect(visualStyles).toContain('.hero.visual-resources .secondary')
    expect(visualStyles).toContain('.hero.visual-tournament .secondary')
  })

  it('keeps contextual artwork inside the iPhone viewport', () => {
    const visualStyles = readFileSync(join(process.cwd(), 'app/components/contextual-tennis-visual.module.css'), 'utf8').replace(/\r\n/g, '\n')

    expect(visualStyles).toContain('max-width: 100%;')
    expect(visualStyles).toContain('.hero {\n    right: 0;')
    expect(visualStyles).toContain('.atmosphere {\n    right: 0;')
    expect(visualStyles).toContain('width: min(82vw, 360px);')
    expect(visualStyles).not.toContain('right: -96px;')
    expect(clubStyles).toContain('inset: auto 0 0 auto;')
    expect(clubStyles).not.toContain('inset: auto -70px -100px auto;')
  })

  it('keeps the Captain team and checklist watermark as a spaced diagonal pair on phone screens', () => {
    const visualStyles = readFileSync(join(process.cwd(), 'app/components/contextual-tennis-visual.module.css'), 'utf8').replace(/\r\n/g, '\n')

    expect(visualStyles).toContain('.atmosphere.visual-captain .primary {\n  transform: translate(-12%, 13%) scale(0.88) rotate(2deg);')
    expect(visualStyles).toContain('.atmosphere.visual-captain .secondary {\n  right: 6%;\n  top: 6%;\n  transform: scale(0.76) rotate(6deg);')
    expect(visualStyles).toContain('.atmosphere.visual-captain .primary {\n    transform: translate(-13%, 15%) scale(0.84) rotate(2deg);')
    expect(visualStyles).toContain('.atmosphere.visual-captain .secondary {\n    right: 6%;\n    top: 9%;\n    transform: scale(0.72) rotate(6deg);')
  })
})
