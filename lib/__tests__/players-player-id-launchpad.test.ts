import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/players/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const match = source.match(new RegExp(`const ${styleName}: CSSProperties = \\{[\\s\\S]*?\\n\\}`))
  expect(match, `${styleName} style block`).not.toBeNull()
  return match![0]
}

describe('Players Player ID launchpad', () => {
  it('connects player discovery to the Player ID flow', () => {
    expect(source).toContain('playerIdLaunchpadSignals')
    expect(source).toContain('Player ID launchpad')
    expect(source).toContain('Turn search into a player record.')
    expect(source).toContain('Find the ID')
    expect(source).toContain('Your anchor')
    expect(source).toContain('Next move')
    expect(source).toContain('Starter read')
    expect(source).toContain('Profile, Matchup, My Lab')
    expect(source).toContain('DIRECTORY_PLAYER_IDENTITY_READ.label')
    expect(source).toContain('DIRECTORY_PLAYER_IDENTITY_READ.levelUpNudge')
    expect(source).toContain('Set your profile so player discovery can hand off to Matchup and My Lab with you preloaded.')
    expect(source).toContain('Open the record, compare the matchup, follow the player, or send missing context through Data Assist.')
    expect(source).toContain('No match history yet? Start with a Level Up identity, then let the profile record sharpen the next cue.')
    expect(source).toContain('<TiqFeatureIcon name="playerRatings" size="sm" variant="ghost" />')
  })

  it('adds a direct Level Up starter path before search results', () => {
    expect(source).toContain("import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'")
    expect(source).toContain("const DIRECTORY_PLAYER_IDENTITY = getPlayerDevelopmentIdentity('relentless-competitor-4-0')")
    expect(source).toContain('const DIRECTORY_LEVEL_UP_HREF = `/level-up/${DIRECTORY_PLAYER_IDENTITY.slug}`')
    expect(source).toContain('const DIRECTORY_PLAYER_DEVELOPMENT_HREF = `/player-development/${DIRECTORY_PLAYER_IDENTITY.slug}`')
    expect(source).toContain('Player ID starter path')
    expect(source).toContain('aria-label="Player ID starter read"')
    expect(source).toContain('Train first')
    expect(source).toContain('Proof target')
    expect(source).toContain('Match test')
    expect(source).toContain('Start Level Up')
    expect(source).toContain('Read Player ID')
    expect(source.indexOf('Player ID starter path')).toBeLessThan(source.indexOf('{loading ? ('))
  })

  it('keeps the launchpad compact and mobile-safe', () => {
    expect(styleBlock('playerIdLaunchpadStyle')).toContain('minWidth: 0')
    expect(styleBlock('playerIdLaunchpadStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('playerIdLaunchpadHeaderStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('playerIdLaunchpadGridStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))'")
    expect(styleBlock('playerIdLaunchpadGridStyle')).toContain('minWidth: 0')
    expect(styleBlock('playerIdLaunchpadCardStyle')).toContain('minWidth: 0')
    expect(styleBlock('playerIdLaunchpadCardStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('playerIdLaunchpadTextStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('playerIdStarterReadStyle')).toContain('minWidth: 0')
    expect(styleBlock('playerIdStarterReadGridStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))'")
    expect(styleBlock('playerIdStarterReadItemStyle')).toContain('minWidth: 0')
    expect(styleBlock('playerIdStarterReadItemStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('playerIdStarterActionRowStyle')).toContain("flexWrap: 'wrap'")
  })
})
