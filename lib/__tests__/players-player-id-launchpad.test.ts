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
    expect(source).toContain('Profile, Matchup, My Lab')
    expect(source).toContain('Set your profile so player discovery can hand off to Matchup and My Lab with you preloaded.')
    expect(source).toContain('Open the record, compare the matchup, follow the player, or send missing context through Data Assist.')
    expect(source).toContain('<TiqFeatureIcon name="playerRatings" size="sm" variant="ghost" />')
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
  })
})
