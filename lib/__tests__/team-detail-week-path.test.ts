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
    expect(source).not.toContain('PRODUCT_MOTTO')
    expect(source).toContain('the team context that helps everyone stay ready')
    expect(source).toContain('canManageThisTeam ? (')
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

  it('keeps the core team jobs first and removes generic player-ID detours', () => {
    expect(source).toContain('aria-label="Team page sections"')
    expect(source).toContain('href="#team-overview"')
    expect(source).toContain('href="#team-schedule"')
    expect(source).toContain('href="#team-roster"')
    expect(source).toContain('id="team-schedule"')
    expect(source).toContain('id="team-roster"')
    expect(source).not.toContain('Roster Player ID trail')
    expect(source).not.toContain('ROSTER_PLAYER_IDENTITY')
    expect(source).not.toContain("import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'")
  })

  it('renders a purpose-built phone roster instead of compressing nine table columns', () => {
    expect(source).toContain('style={mobileRosterListStyle}')
    expect(source).toContain('style={mobileRosterCardStyle}')
    expect(source).toContain('style={mobileRosterMetricGridStyle}')
    expect(styleBlock('mobileRosterMetricGridStyle')).toContain("gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'")
    expect(styleBlock('mobileRosterCardStyle')).toContain('minWidth: 0')
    expect(styleBlock('mobileRosterIdentityStyle')).toContain("overflowWrap: 'anywhere'")
  })

  it('keeps long team detail tables short by default with user-opened detail', () => {
    expect(source).toContain('const [showFullMatchHistory, setShowFullMatchHistory] = useState(false)')
    expect(source).toContain('const [showFullRoster, setShowFullRoster] = useState(false)')
    expect(source).toContain('const visibleRoster = showFullRoster ? filteredRoster : filteredRoster.slice(0, 12)')
    expect(source).toContain('const upcomingCards = filteredCards')
    expect(source).toContain('const completedCards = filteredCards')
    expect(source).toContain('...upcomingCards.slice(0, 2), ...completedCards.slice(0, 2)')
    expect(source).toContain('const visibleCards = showFullMatchHistory ? orderedCards : previewCards')
    expect(source).toContain('Show how this team page is checked')
    expect(source).toContain('detailDrawerStyle')
    expect(source).toContain('tableControlRowStyle')
    expect(source).toContain('tableToggleButtonStyle')
    expect(source).toContain('Show fewer matches')
    expect(source).toContain('Show fewer players')
    expect(styleBlock('detailDrawerSummaryStyle')).toContain("cursor: 'pointer'")
    expect(styleBlock('tableToggleButtonStyle')).toContain("whiteSpace: 'normal'")
    expect(source).toContain('{isMobile ? (')
    expect(source).toContain('style={mobileMatchListStyle}')
    expect(source).toContain('style={mobileMatchCardStyle}')
    expect(styleBlock('mobileMatchFactsStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('panelCountPill')).toContain("whiteSpace: 'nowrap'")
  })

  it('does not render empty analysis sections before the team has usable data', () => {
    expect(source).toContain('{tiqParticipations.length || tiqParticipationWarning ? (')
    expect(source).toContain('{roster.length || bestSingles.length || pairings.length ? (')
    expect(source).toContain('{matches.length ? (')
    expect(source).toContain('{roster.length ? (')
    expect(source).not.toContain('<span style={metricLabel}>Imported Scorecards</span>')
    expect(source).not.toContain('const teamSignals = [')
    expect(source).not.toContain('Next Best Actions')
  })

  it('keeps opponent records accurate and readable without a six-column phone table', () => {
    expect(source).toContain('const normalizedTeam = normalizeTeamName(teamName)')
    expect(source).toContain('normalizeTeamName(home) === normalizedTeam')
    expect(source).toContain('normalizeTeamName(away) === normalizedTeam')
    expect(source).toContain('style={opponentCardStyle(isSmallMobile)}')
    expect(source).toContain('style={opponentRecordStyle}')
    expect(source).toContain('<details style={opponentBreakdownDetailsStyle}>')
    expect(source).toContain('<span>Record vs. opponents</span>')
    expect(source).toContain('Last met {formatDate(opp.lastDate)}')
    expect(source).not.toContain("['Opponent', 'W', 'L', 'Win %', 'Matches', 'Last met']")
    expect(styleBlock('opponentCardStyle')).toContain("flexDirection: isSmallMobile ? 'column' : 'row'")
    expect(styleBlock('opponentRecordStyle')).toContain("gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'")
  })
})
