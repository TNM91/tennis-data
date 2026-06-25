import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/teams/[team]/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start, styleName).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('team detail week path', () => {
  it('answers the captain match-week questions on team detail pages', () => {
    expect(source).toContain('PRODUCT_MOTTO')
    expect(source).toContain('Team Hub context that helps captains plan the week')
    expect(source).toContain('Team week path')
    expect(source).toContain('Answer match week from your phone.')
    expect(source).toContain('Who is available?')
    expect(source).toContain('What lineup gives us the best chance?')
    expect(source).toContain('Who should play together?')
    expect(source).toContain('What should I communicate?')
    expect(source).toContain('data-team-week-job={item.job}')
    expect(source).toContain('aria-label={`${item.cta}: ${item.question}`}')
  })

  it('keeps the team week path compact and mobile-safe', () => {
    expect(source).toContain('teamWeekPathStyle(isTablet)')
    expect(styleBlock('teamWeekPathStyle')).toContain("gridTemplateColumns: isTablet ? 'minmax(0, 1fr)'")
    expect(styleBlock('teamWeekPathGridStyle')).toContain("gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)'")
    expect(styleBlock('teamWeekActionCardStyle')).toContain('minHeight: 146')
    expect(styleBlock('teamWeekActionCardStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('teamWeekActionTextStyle')).toContain("overflowWrap: 'anywhere'")
  })

  it('connects roster review to player ID actions', () => {
    expect(source).toContain('rosterPlayerIdSignals')
    expect(source).toContain('Roster Player ID trail')
    expect(source).toContain('Roster IDs')
    expect(source).toContain('Compare next')
    expect(source).toContain('Captain handoff')
    expect(source).toContain('Open each player record before turning team context into lineup or matchup decisions.')
    expect(source).toContain('Select two roster players to prep a singles matchup')
    expect(source).toContain('Use the same player IDs for availability, lineup building, pairing choices, and Data Assist review.')
    expect(source).toContain("import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'")
    expect(source).toContain("const ROSTER_PLAYER_IDENTITY = getPlayerDevelopmentIdentity('relentless-competitor-4-0')")
    expect(source).toContain('const ROSTER_LEVEL_UP_HREF = `/level-up/${ROSTER_PLAYER_IDENTITY.slug}`')
    expect(source).toContain('const ROSTER_PLAYER_DEVELOPMENT_HREF = `/player-development/${ROSTER_PLAYER_IDENTITY.slug}`')
    expect(source).toContain('Roster Player ID starter')
    expect(source).toContain('aria-label="Roster Player ID starter read"')
    expect(source).toContain('Train first')
    expect(source).toContain('Proof target')
    expect(source).toContain('Match test')
    expect(source).toContain('Start Level Up')
    expect(source).toContain('Read Player ID')
  })

  it('keeps the roster player ID trail readable on phone widths', () => {
    expect(styleBlock('rosterPlayerIdTrailStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))'")
    expect(styleBlock('rosterPlayerIdTrailStyle')).toContain('minWidth: 0')
    expect(styleBlock('rosterPlayerIdSignalStyle')).toContain('minWidth: 0')
    expect(styleBlock('rosterPlayerIdSignalStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('rosterPlayerIdSignalValueStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('rosterPlayerIdSignalTextStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('rosterPlayerIdStarterStyle')).toContain('minWidth: 0')
    expect(styleBlock('rosterPlayerIdStarterStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('rosterPlayerIdStarterGridStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))'")
    expect(styleBlock('rosterPlayerIdStarterItemStyle')).toContain('minWidth: 0')
    expect(styleBlock('rosterPlayerIdStarterItemStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('rosterPlayerIdStarterActionRowStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('rosterPlayerIdStarterLinkStyle')).toContain('minWidth: 0')
  })
})
