import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const shellSource = readFileSync(join(process.cwd(), 'app/components/site-shell.tsx'), 'utf8')

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
})
