import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/matchup/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start, styleName).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('matchup prep path', () => {
  it('frames Matchup as a quick compete prep path', () => {
    expect(source).toContain('PRODUCT_MOTTO')
    expect(source).toContain('Matchup prep path')
    expect(source).toContain('Know what matters before match time.')
    expect(source).toContain('What matchup matters?')
    expect(source).toContain('What should I watch first?')
    expect(source).toContain('What do I do next?')
    expect(source).toContain('Matchup is a quick prep read')
    expect(source).toContain('data-matchup-prep-job={item.job}')
  })

  it('connects Matchup to the player ID trail', () => {
    expect(source).toContain('matchupPlayerIdSignals')
    expect(source).toContain('Matchup player ID trail')
    expect(source).toContain('Make the read part of the player record.')
    expect(source).toContain('Player ID')
    expect(source).toContain('Opponent slot')
    expect(source).toContain('Next use')
    expect(source).toContain('Save the takeaway')
    expect(source).toContain('Use the matchup edge in My Lab, Level Up work, captain prep, or team decisions.')
    expect(source).toContain("import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'")
    expect(source).toContain("const MATCHUP_PLAYER_IDENTITY = getPlayerDevelopmentIdentity('relentless-competitor-4-0')")
    expect(source).toContain('const MATCHUP_LEVEL_UP_HREF = `/level-up/${MATCHUP_PLAYER_IDENTITY.slug}#level-up-flow`')
    expect(source).toContain('const MATCHUP_PLAYER_DEVELOPMENT_HREF = `/player-development/${MATCHUP_PLAYER_IDENTITY.slug}`')
    expect(source).toContain('Player ID matchup starter')
    expect(source).toContain('aria-label="Matchup Player ID starter read"')
    expect(source).toContain('Train first')
    expect(source).toContain('Proof target')
    expect(source).toContain('Match test')
    expect(source).toContain('Start Level Up')
    expect(source).toContain('Read Player ID')
    expect(source).toContain('<TiqFeatureIcon name="playerRatings" size="sm" variant="ghost" />')
  })

  it('keeps the prep path compact and mobile-safe', () => {
    expect(source).toContain('matchupPrepGridStyle(isSmallMobile)')
    expect(styleBlock('matchupPrepPathStyle')).toContain('minWidth: 0')
    expect(styleBlock('matchupPrepPathStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('matchupPrepGridStyle')).toContain("gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : 'repeat(3, minmax(0, 1fr))'")
    expect(styleBlock('matchupPrepCardStyle')).toContain('minHeight: 124')
    expect(styleBlock('matchupPrepCardStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('matchupPrepCardTextStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('matchupPlayerIdTrailStyle')).toContain('minWidth: 0')
    expect(styleBlock('matchupPlayerIdTrailStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('matchupPlayerIdTrailGridStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))'")
    expect(styleBlock('matchupPlayerIdSignalStyle')).toContain('minWidth: 0')
    expect(styleBlock('matchupPlayerIdSignalBodyStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('matchupPlayerIdStarterStyle')).toContain('minWidth: 0')
    expect(styleBlock('matchupPlayerIdStarterStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('matchupPlayerIdStarterGridStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))'")
    expect(styleBlock('matchupPlayerIdStarterItemStyle')).toContain('minWidth: 0')
    expect(styleBlock('matchupPlayerIdStarterItemStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('matchupPlayerIdStarterActionRowStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('matchupPlayerIdStarterLinkStyle')).toContain('minWidth: 0')
  })
})
