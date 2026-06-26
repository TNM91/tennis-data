import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/explore/search/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}:`)
  expect(start, `Missing ${styleName}`).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Explore Search Player ID trail', () => {
  it('turns search into a Player ID action path', () => {
    expect(source).toContain('playerIdSearchTrailSignals')
    expect(source).toContain('Search Player ID trail')
    expect(source).toContain('Player ID search trail')
    expect(source).toContain('Turn a search into the next tennis action.')
    expect(source).toContain('Search job')
    expect(source).toContain('Player ID handoff')
    expect(source).toContain('Starter read')
    expect(source).toContain('SEARCH_PLAYER_IDENTITY_READ')
    expect(source).toContain('const SEARCH_LEVEL_UP_HREF = `/level-up/${SEARCH_PLAYER_IDENTITY.slug}#level-up-flow`')
    expect(source).toContain('Search Player ID starter read')
    expect(source).toContain('Start Level Up')
    expect(source).toContain('Read Player ID')
    expect(source).toContain('Open Player ID')
    expect(source).toContain('Open this Player ID, then move into Matchup, My Lab, or Level Up with context.')
    expect(source).toContain('Player records become the anchor for ratings, matchup prep, follows, and Level Up work.')
    expect(source).toContain('levelUpNudge')
  })

  it('keeps the Player ID search trail compact and mobile-safe', () => {
    expect(styleBlock('playerIdSearchTrailStyle')).toContain('minWidth: 0')
    expect(styleBlock('playerIdSearchTrailStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('playerIdSearchTrailHeaderStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('playerIdSearchTrailGridStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))'")
    expect(styleBlock('playerIdSearchTrailGridStyle')).toContain('minWidth: 0')
    expect(styleBlock('playerIdStarterReadGridStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 168px), 1fr))'")
    expect(styleBlock('playerIdStarterReadGridStyle')).toContain('minWidth: 0')
    expect(styleBlock('playerIdSearchTrailCardStyle')).toContain('minWidth: 0')
    expect(styleBlock('playerIdSearchTrailCardStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('playerIdSearchTrailActionRowStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('playerIdSearchTrailActionStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock('playerIdSearchTrailTextStyle')).toContain("overflowWrap: 'anywhere'")
  })
})
