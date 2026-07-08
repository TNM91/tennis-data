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

describe('Explore Search next actions', () => {
  it('turns a search result into practical tennis actions', () => {
    expect(source).toContain('searchNextActions')
    expect(source).toContain('Search next actions')
    expect(source).toContain('After search')
    expect(source).toContain('Open the record, then act on it.')
    expect(source).toContain('Open profile')
    expect(source).toContain('Compare matchup')
    expect(source).toContain('Build practice plan')
    expect(source).toContain('SEARCH_PLAYER_IDENTITY_READ')
    expect(source).toContain('const SEARCH_LEVEL_UP_HREF = `/level-up/${SEARCH_PLAYER_IDENTITY.slug}#level-up-flow`')
    expect(source).toContain('Start Level Up')
    expect(source).toContain('Open Matchup')
    expect(source).toContain('Open Player ID')
    expect(source).toContain('Open the public player page when the right record appears.')
    expect(source).toContain('Use two player records to prep the rating gap, why it matters, and what to watch.')
    expect(source).toContain('levelUpNudge')
    expect(source).not.toContain('Player ID search trail')
    expect(source).not.toContain('Search Player ID starter read')
  })

  it('keeps the search next actions compact and mobile-safe', () => {
    expect(styleBlock('searchNextActionsStyle')).toContain('minWidth: 0')
    expect(styleBlock('searchNextActionsStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('searchNextActionsHeaderStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('searchNextActionsGridStyle')).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))'")
    expect(styleBlock('searchNextActionsGridStyle')).toContain('minWidth: 0')
    expect(styleBlock('searchNextActionCardStyle')).toContain('minWidth: 0')
    expect(styleBlock('searchNextActionCardStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('searchNextActionLinkStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock('searchNextActionsTextStyle')).toContain("overflowWrap: 'anywhere'")
  })
})
