import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function styleBlock(source: string, styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

const globalsSource = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')

describe('tournament Full-Court value panel', () => {
  it('shows a compact premium value stack instead of a plain limit note', () => {
    const source = readFileSync(join(process.cwd(), 'app/components/tournament-builder-workspace.tsx'), 'utf8')

    expect(source).toContain('Full-Court tournament command.')
    expect(source).toContain('Unlimited events')
    expect(source).toContain('Award studio')
    expect(source).toContain('Participant alerts')
    expect(source).toContain('League + team actions')
    expect(source).not.toContain('League + team tools')
    expect(source).toContain('fullCourtFeatureGridStyle')
  })

  it('keeps locked visitors in a preview instead of exposing the full builder workspace', () => {
    const source = readFileSync(join(process.cwd(), 'app/components/tournament-builder-workspace.tsx'), 'utf8')

    expect(source).toContain('Tournament Desk preview')
    expect(source).toContain('Unlock Tournament Desk with Full-Court')
    expect(source).toContain('summaryOnly')
    expect(source).toContain('Show Tournament Desk preview')
    expect(source).toContain('<details className="tournamentBuilderDetailsSection" style={heroPanelStyle}>')
    expect(source).toContain('<details className="tournamentBuilderDetailsSection" style={lockedPreviewDetailsStyle}>')
    expect(globalsSource).toContain('.tournamentBuilderDetailsSection:not([open]) > :not(summary)')
    expect(source).toContain('lockedPreviewDetailsStyle')
    expect(source).toContain('lockedPreviewDetailsSummaryStyle')
    expect(source).toContain('<div style={eyebrowStyle}>Tournament Desk</div>')
    expect(source).toContain('lockedTournamentActions')
    expect(source).toContain('Run the event without a spreadsheet stack.')
    expect(source).toContain("if (!canUseLeague && authResolved)")
    expect(source).toContain("const lockedPrimaryHref = role === 'public'")
    expect(source).toContain("'/join?plan=full_court&next=%2Fleague-coordinator%2Ftournaments'")
    expect(source).toContain("const lockedPrimaryLabel = role === 'public' ? 'Create account' : 'Compare Full-Court'")
    expect(source).not.toContain("'/join?plan=full_court&next=/league-coordinator/tournaments'")
    expect(source).not.toContain('Tournament rooms sit inside League, but unlimited events are part of Full-Court.')
    expect(source).not.toContain('Tournament Builder')

    const heroActionsIndex = source.indexOf('<Link href={lockedPrimaryHref} style={primaryButtonStyle}>{lockedPrimaryLabel}</Link>')
    const lockedPreviewIndex = source.indexOf('<section style={lockedPreviewStyle} aria-label="Tournament Desk preview">')
    expect(heroActionsIndex).toBeGreaterThan(source.indexOf('<section style={heroStyle}>'))
    expect(heroActionsIndex).toBeLessThan(lockedPreviewIndex)
  })

  it('keeps the Tournament Desk value panel compact and optional after setup', () => {
    const source = readFileSync(join(process.cwd(), 'app/components/tournament-builder-workspace.tsx'), 'utf8')

    expect(source).toContain('Create the field, schedule courts, post scores, send alerts, and finish awards from one event desk.')
    expect(source).not.toContain('Create player or team events, manage entries, build draws, schedule courts, enter scores, and publish results from one event desk.')
    expect(source).toContain('<details className="tournamentBuilderDetailsSection" style={heroStyle}>')
    expect(source).toContain('Season and plan details')
    expect(source).toContain('Run or update a tournament')
    expect(source.indexOf('<section style={tournamentPathStyle}')).toBeLessThan(source.indexOf('<section style={builderGridStyle}>'))
    expect(source.indexOf('<details className="tournamentBuilderDetailsSection" style={heroStyle}>')).toBeGreaterThan(source.indexOf('<section style={builderGridStyle}>'))

    const heroStyle = styleBlock(source, 'heroStyle')
    expect(heroStyle).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))'")
    expect(heroStyle).toContain('padding: 18')
    expect(heroStyle).toContain('borderRadius: 24')

    const titleStyle = styleBlock(source, 'titleStyle')
    expect(titleStyle).toContain("fontSize: 'clamp(1.9rem, 3.45vw, 3.45rem)'")

    const statGridStyle = styleBlock(source, 'statGridStyle')
    expect(statGridStyle).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 132px), 1fr))'")

    const watermarkStyle = styleBlock(source, 'watermarkStyle')
    expect(watermarkStyle).toContain('right: 0')
    expect(watermarkStyle).toContain("width: 'min(100%, 320px)'")
  })
})
