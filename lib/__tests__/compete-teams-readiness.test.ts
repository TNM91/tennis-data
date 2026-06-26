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
  it('gives Teams visitors a clear first-action path', () => {
    expect(source).toContain("import { PRODUCT_MOTTO } from '@/lib/product-story'")
    expect(source).toContain('const teamPathActions')
    expect(source).toContain('function TeamPathPanel')
    expect(source).toContain('Team path')
    expect(source).toContain('id="compete-team-path-title"')
    expect(source).toContain('Start with the team need, then open the smallest action that turns context into a captain move.')
    expect(source).not.toContain('Start with the team job, then open the smallest action that turns context into a captain move.')
    expect(source).toContain('Which team am I reading?')
    expect(source).toContain('Find a team')
    expect(source).toContain('How do I refresh the roster?')
    expect(source).toContain('Upload team data')
    expect(source).toContain('What lineup gives us the best chance?')
    expect(source).toContain('What happened last match?')
    expect(source).toContain('Open team book')
    expect(source).toContain('data-compete-team-path-job={action.job}')
    expect(source).toContain('id="tiq-entered-teams"')
    expect(source).toContain('messaging through Team Hub')
    expect(source).toContain('League Office keeps season structure, standings, scheduling, and team coordination organized instead of scattered spreadsheet cleanup.')
    expect(source).not.toContain('messaging in one workspace')
    expect(source).not.toContain('League gives you one place for season structure')
  })

  it('keeps Team path cards tappable on mobile', () => {
    expect(styleBlock('teamPathStyle')).toContain('minWidth: 0')
    expect(styleBlock('teamPathStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('teamPathHeaderStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('teamPathGridStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))'")
    expect(styleBlock('teamPathCardStyle')).toContain('minHeight: 148')
    expect(styleBlock('teamPathCardStyle')).toContain("overflowWrap: 'anywhere'")
  })

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

  it('connects team context back into Player ID and Level Up prep', () => {
    expect(source).toContain("import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'")
    expect(source).toContain("const TEAM_PLAYER_IDENTITY = getPlayerDevelopmentIdentity('doubles-commander-4-0')")
    expect(source).toContain('const TEAM_PLAYER_IDENTITY_READ = getPlayerDevelopmentIdentityActionRead(TEAM_PLAYER_IDENTITY)')
    expect(source).toContain('const TEAM_LEVEL_UP_HREF = `/level-up/${TEAM_PLAYER_IDENTITY.slug}#level-up-flow`')
    expect(source).toContain('const TEAM_PLAYER_DEVELOPMENT_HREF = `/player-development/${TEAM_PLAYER_IDENTITY.slug}`')
    expect(source).toContain('aria-label="Teams Player ID team prep"')
    expect(source).toContain('aria-label="Teams Player ID starter read"')
    expect(source).toContain('Team read to Player ID')
    expect(source).toContain('Pick the player cue before the lineup.')
    expect(source).toContain('Use the same Player ID read to turn team context into one Level Up rep, one roster proof point, and one captain move.')
    expect(source).toContain('Start Level Up')
    expect(source).toContain('Read Player ID')
    expect(source).toContain('Open Team Hub')
    expect(source.indexOf('<TeamPlayerIdPrepPanel />')).toBeGreaterThan(source.indexOf('<TeamPathPanel />'))
    expect(source.indexOf('<TeamPlayerIdPrepPanel />')).toBeLessThan(source.indexOf('<CompeteGrid>'))
  })

  it('keeps the Teams Player ID prep bridge mobile-safe', () => {
    expect(styleBlock('teamPlayerIdPrepStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))'")
    expect(styleBlock('teamPlayerIdPrepStyle')).toContain('minWidth: 0')
    expect(styleBlock('teamPlayerIdPrepStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('teamPlayerIdPrepGridStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))'")
    expect(styleBlock('teamPlayerIdPrepCardStyle')).toContain('minWidth: 0')
    expect(styleBlock('teamPlayerIdActionRowStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('teamPlayerIdActionStyle')).toContain("maxWidth: '100%'")
    expect(styleBlock('teamPlayerIdActionStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock('teamPlayerIdActionStyle')).toContain("overflowWrap: 'anywhere'")
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
    expect(source).toContain("const dataAssistTeamsHref = '/data-assist?intent=upload-source&context=League%20Office%20teams'")
    expect(source).not.toContain('context=Compete%20teams')
    expect(source).toContain("href: dataAssistTeamsHref")
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
