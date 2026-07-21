import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/teams/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const match = source.match(new RegExp(`const ${styleName}: CSSProperties = \\{[\\s\\S]*?\\n\\}`))
  expect(match, `${styleName} style block`).not.toBeNull()
  return match![0]
}

describe('Teams Hub preview', () => {
  it('makes Team Hub and Captain Tools concrete before directory results', () => {
    expect(source).toContain('TeamWeekSpotlight')
    expect(source).toContain('TeamWeekStep')
    expect(source).toContain('Captain decision path')
    expect(source).toContain('Who can play, where they fit, and what gets sent?')
    expect(source).toContain('reduce match-week chaos')
    expect(source).toContain('Who is available?')
    expect(source).toContain('What lineup gives us the best chance?')
    expect(source).toContain('Who should play together?')
    expect(source).toContain('What should I communicate?')
    expect(source).toContain('Check Availability')
    expect(source).toContain('Build Lineup')
    expect(source).toContain('Test Pairings')
    expect(source).toContain('Send Team Plan')
    expect(source).toContain('Team Hub preview')
    expect(source).toContain('Availability, lineup, scouting, and match week.')
    expect(source).toContain('TiqWorkspacePreview')
    expect(source).toContain('Opponent scouting')
    expect(source).toContain('teamWeekBoardStyle(isMobile, isTablet)')
  })

  it('tracks availability, lineup, and scouting actions from the preview band', () => {
    expect(source).toContain("eventName: 'availability_clicked'")
    expect(source).toContain("eventName: 'lineup_preview_clicked'")
    expect(source).toContain("eventName: 'captain_tools_clicked'")
    expect(source).toContain("eventName: 'matchup_started'")
    expect(source).toContain("location: 'team_hub_preview'")
    expect(source).toContain("location: 'team_next_actions'")
  })

  it('connects team search and filter labels to their controls', () => {
    expect(source).toContain('<label htmlFor="team-directory-search"')
    expect(source).toContain('id="team-directory-search"')
    expect(source).toContain('<label htmlFor="team-directory-league"')
    expect(source).toContain('id="team-directory-league"')
    expect(source).toContain('<label htmlFor="team-directory-flight"')
    expect(source).toContain('id="team-directory-flight"')
    expect(source).toContain('<label htmlFor="team-directory-sort"')
    expect(source).toContain('id="team-directory-sort"')
    expect(source).not.toContain('<label style={labelStyle}>Search</label>')
  })

  it('keeps team directory filter focus states visible', () => {
    expect(source).toContain('const [focusedDirectoryControl, setFocusedDirectoryControl]')
    expect(source).toContain("onFocus={() => setFocusedDirectoryControl('search')}")
    expect(source).toContain("onFocus={() => setFocusedDirectoryControl('league')}")
    expect(source).toContain("onFocus={() => setFocusedDirectoryControl('flight')}")
    expect(source).toContain("onFocus={() => setFocusedDirectoryControl('sort')}")
    expect(source).toContain('directoryControlFocusStyle')
    expect(source).toContain("outline: '2px solid transparent'")
    expect(source).not.toContain("outline: 'none'")
  })

  it('caps team directory cards before showing the full board', () => {
    expect(source).toContain('const TEAM_DEFAULT_CARD_LIMIT = 8')
    expect(source).toContain('const [showAllTeams, setShowAllTeams]')
    expect(source).toContain('filteredRows.slice(0, TEAM_DEFAULT_CARD_LIMIT)')
    expect(source).toContain('const hasMoreTeams = shouldShowTeamResults && filteredRows.length > TEAM_DEFAULT_CARD_LIMIT')
    expect(source).toContain('Showing {visibleRows.length} of {filteredRows.length} teams.')
    expect(source).toContain("{showAllTeams ? 'Show top teams' : 'Show full directory'}")
    expect(source).toContain('setShowAllTeams(false)')
    expect(styleBlock('teamBoardLimitRowStyle')).toContain("gridColumn: '1 / -1'")
    expect(styleBlock('teamBoardLimitRowStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('teamBoardLimitTextStyle')).toContain("overflowWrap: 'anywhere'")
  })

  it('keeps repeated team-card trust details on request', () => {
    expect(source).toContain('<details style={teamCardTrustDetailsStyle}>')
    expect(source).toContain('<summary style={teamCardTrustSummaryStyle}>')
    expect(source).toContain('Data check')
    expect(source).toContain("row.mostRecentMatchDate ? 'Match context' : 'Review pending'")
    expect(source).toContain('<div style={teamCardTrustBodyStyle}>')
    expect(source).toContain("formatShortDate(row.mostRecentMatchDate, '--')")
    expect(source).toContain("{row.wins}W - {winPct}%")
    expect(styleBlock('teamCardTrustDetailsStyle')).toContain('minWidth: 0')
    expect(styleBlock('teamCardTrustSummaryStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('teamCardTrustSummaryStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('teamCardTrustBodyStyle')).toContain('minWidth: 0')
  })
})
