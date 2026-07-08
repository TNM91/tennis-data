import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function styleBlock(source: string, styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

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
    expect(source).toContain('<div style={eyebrowStyle}>Tournament Desk</div>')
    expect(source).toContain('lockedTournamentActions')
    expect(source).toContain('Run the event without a spreadsheet stack.')
    expect(source).toContain("if (!canUseLeague && authResolved)")
    expect(source).toContain("'/join?plan=full_court&next=%2Fleague-coordinator%2Ftournaments'")
    expect(source).not.toContain("'/join?plan=full_court&next=/league-coordinator/tournaments'")
    expect(source).not.toContain('Tournament rooms sit inside League, but unlimited events are part of Full-Court.')
    expect(source).not.toContain('Tournament Builder')
  })

  it('keeps the Tournament Desk hero compact before the command path', () => {
    const source = readFileSync(join(process.cwd(), 'app/components/tournament-builder-workspace.tsx'), 'utf8')

    expect(source).toContain('Create the field, schedule courts, post scores, send alerts, and finish awards from one event desk.')
    expect(source).not.toContain('Create player or team events, manage entries, build draws, schedule courts, enter scores, and publish results from one event desk.')

    const heroStyle = styleBlock(source, 'heroStyle')
    expect(heroStyle).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))'")
    expect(heroStyle).toContain('padding: 18')
    expect(heroStyle).toContain('borderRadius: 24')

    const titleStyle = styleBlock(source, 'titleStyle')
    expect(titleStyle).toContain("fontSize: 'clamp(1.9rem, 3.45vw, 3.45rem)'")

    const statGridStyle = styleBlock(source, 'statGridStyle')
    expect(statGridStyle).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 132px), 1fr))'")
  })
})
