import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start, `Missing ${styleName}`).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('My Lab Matchbook', () => {
  it('keeps player match history private, filterable, and compact', () => {
    expect(source).toContain('Your Matchbook')
    expect(source).toContain('Results without the clutter.')
    expect(source).toContain('filterMatchbookEntries(personalMatches, matchbookFilter)')
    expect(source).toContain('MATCHBOOK_FILTERS.map')
    expect(source).toContain("surface: 'mylab_matchbook'")
    expect(source).toContain('followMatchOpponents(match)')
    expect(source).toContain('Watch opponent')
    expect(source).toContain('Show fewer matches')
    expect(source).toContain('canUseAdvancedPlayerInsights ? (')
  })

  it('does not retain the duplicate lower recent-match card', () => {
    expect(source).not.toContain("surface: 'mylab_recent_matches'")
    expect(source).not.toContain('<div id="recent-matches" style={workshopPanelStyle}>')
  })

  it('keeps Matchbook rows mobile-safe', () => {
    for (const styleName of [
      'matchbookPanelStyle',
      'matchbookHeaderStyle',
      'matchbookFilterStyle',
      'matchbookListStyle',
      'matchbookRowStyle',
      'matchbookCopyStyle',
      'matchbookOpponentStyle',
      'matchbookActionStyle',
      'matchbookWatchButtonStyle',
      'matchbookWatchDoneButtonStyle',
      'matchbookMoreButtonStyle',
    ]) {
      expect(styleBlock(styleName)).toContain('minWidth: 0')
    }

    expect(styleBlock('matchbookRowStyle')).toContain('gridTemplateColumns: isTablet')
    expect(styleBlock('matchbookRowStyle')).toContain("'minmax(0, auto) minmax(0, 1fr)'")
    expect(styleBlock('matchbookActionStyle')).toContain("gridColumn: isTablet ? '1 / -1' : undefined")
    expect(styleBlock('matchbookMoreButtonStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock('matchbookWatchButtonStyle')).toContain("whiteSpace: 'normal'")
  })
})
