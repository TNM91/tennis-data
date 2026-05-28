import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/compete/teams/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const pattern = new RegExp(`const ${styleName}(?:: CSSProperties)? = ([\\s\\S]*?)(?=\\nconst |\\nfunction |\\nexport |$)`)
  const match = source.match(pattern)
  if (!match) throw new Error(`Missing style block: ${styleName}`)
  return match[0]
}

describe('compete teams readiness', () => {
  it('keeps the Teams top actions aligned with League and Team handoffs', () => {
    expect(source).toContain('title="Team directory"')
    expect(source).toContain('title="Team book"')
    expect(source).toContain('title="Build lineup"')
    expect(source).toContain('title="Match dates"')
    expect(source).toContain('href="/league-coordinator/results"')
    expect(source).toContain('href="/compete/schedule"')
    expect(source).not.toContain('title="Team Directory"')
    expect(source).not.toContain('title="Availability"')
    expect(source).not.toContain('title="Lineup Builder"')
  })

  it('turns TIQ team rows into readiness-driven workflow objects', () => {
    expect(source).toContain('teamReadinessItems')
    expect(source).toContain("label: 'Leagues'")
    expect(source).toContain("label: 'History'")
    expect(source).toContain("label: 'Captain'")
    expect(source).toContain('Build lineup')
    expect(source).toContain('Open team')
    expect(source).toContain('teamReadinessGridStyle')
    expect(source).toContain('teamPrimaryActionStyle')
    expect(source).toContain('teamSecondaryLinkStyle')
    expect(source).not.toContain('function GhostSmallLink')
    expect(source).not.toContain('buttonWrapStyle')
  })

  it('keeps the empty Teams state actionable and mobile-safe', () => {
    expect(source).toContain('function EmptyTeamsState')
    expect(source).toContain('Team workflow starts with one real team signal.')
    expect(source).toContain('Create team league')
    expect(source).toContain('Refresh team data')
    expect(source).toContain('Browse teams')
    expect(source).not.toContain('No TIQ team entries are visible yet.')
    expect(styleBlock('emptyTeamsStyle')).toContain('minWidth: 0')
    expect(styleBlock('emptyTeamsCopyStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('emptyTeamsActionRowStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('emptyTeamsActionStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock('emptyTeamsActionStyle')).toContain("whiteSpace: 'normal'")
  })
})
