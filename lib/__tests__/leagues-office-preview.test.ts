import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/leagues/page.tsx'), 'utf8')

function styleBlock(name: string) {
  const marker = `const ${name}: CSSProperties = {`
  const start = source.indexOf(marker)
  expect(start, `${name} style should exist`).toBeGreaterThanOrEqual(0)

  const end = source.indexOf('\n}', start)
  expect(end, `${name} style should close`).toBeGreaterThan(start)

  return source.slice(start, end)
}

describe('Leagues Office preview', () => {
  it('makes League Office operations concrete without repeating preview sections', () => {
    expect(source).toContain('Season control board')
    expect(source).toContain('Find the season, then keep it moving.')
    expect(source).toContain('const compactLeagueCommandBoard = isMobile || screenWidth < 1180')
    expect(source).toContain('leagueCommandBoardStyle(compactLeagueCommandBoard)')
    expect(source).toContain('LeagueCommandStep')
    expect(source).toContain("location: 'league_command_board'")
    expect(source).toContain('One place for the season.')
    expect(source).toContain('Useful for coordinators, captains, and players')
    expect(source).toContain("href: '/leagues-and-tournaments'")
    expect(source).toContain("cta: 'Open Organizer Hub'")
    expect(source).toContain('Send Correction')
    expect(source).toContain('create a TIQ League Office tool')
    expect(source).toContain('League data trust and starter path')
    expect(source).toContain('What is refreshing')
    expect(source).toContain('Show source checks')
    expect(source).toContain('Show source needs')
    expect(source).toContain('Show diagnostics')
    expect(source).not.toContain('League Office preview')
    expect(source).not.toContain('TiqActionCard')
    expect(source).not.toContain('TiqWorkspacePreview')
    expect(source).not.toContain('TiqLeagueStandingCard')
    expect(source).not.toContain('create a TIQ league workspace')
    expect(source).not.toContain('create a TIQ League Office workspace')
  })

  it('tracks schedule, standings, organizer, and Data Assist actions', () => {
    expect(source).toContain("eventName: 'schedule_preview_clicked'")
    expect(source).toContain("eventName: 'standings_preview_clicked'")
    expect(source).toContain("eventName: 'league_office_clicked'")
    expect(source).toContain("const dataAssistLeagueOfficeHref = '/data-assist?intent=request-review&context=League%20Office'")
    expect(source).toContain('href={dataAssistLeagueOfficeHref}')
    expect(source).toContain("eventName: 'data_assist_opened'")
    expect(source).toContain("location: 'league_next_actions'")
    expect(source).toContain("location: 'league_command_board'")
  })

  it('keeps league directory filter focus states visible', () => {
    expect(source).toContain('const [focusedDirectoryControl, setFocusedDirectoryControl]')
    expect(source).toContain("onFocus={() => setFocusedDirectoryControl('search')}")
    expect(source).toContain("onFocus={() => setFocusedDirectoryControl('year')}")
    expect(source).toContain("onFocus={() => setFocusedDirectoryControl('season')}")
    expect(source).toContain("onFocus={() => setFocusedDirectoryControl('gender')}")
    expect(source).toContain("onFocus={() => setFocusedDirectoryControl('rating')}")
    expect(source).toContain("onFocus={() => setFocusedDirectoryControl('flight')}")
    expect(source).toContain('directoryControlFocusStyle')
    expect(source).toContain("outline: '2px solid transparent'")
    expect(source).not.toContain("outline: 'none'")
  })

  it('keeps the public league directory compact on phones', () => {
    expect(source).toContain('const visibleLeagueCardLimit = isMobile ? 1 : LEAGUE_DEFAULT_CARD_LIMIT')
    expect(source).toContain('filteredLeagues.slice(0, visibleLeagueCardLimit)')
    expect(source).toContain('filteredLeagues.length > visibleLeagueCardLimit')
    expect(source).toContain('aria-label="League filters"')
    expect(source).toContain('Narrow the league list')
    expect(source).toContain('mobileSummaryPillRowStyle')
    expect(source).toContain('leagueCardDetailsSummaryStyle')
    expect(source).toContain('Data check')
    expect(source).toContain("aria-label={`${league.leagueName} data check`}")
    expect(source).toContain("<strong>{league.latestMatchDate ? 'Match context' : 'Review pending'}</strong>")
    expect(source).not.toContain('<span>Data trust</span>')
    expect(source).not.toContain('<span>Show source</span>')
    expect(source).toContain('className="leagueDetailsSection"')
    expect(source).toContain('className="leagueDetailsBody"')
    expect(styleBlock('leagueDetailsSectionStyle')).toContain("display: 'block'")
    expect(styleBlock('leagueDetailsSectionStyle')).not.toContain("display: 'grid'")
    expect(styleBlock('leagueCardDetailsSummaryStyle')).toContain('borderRadius: 8')
    expect(styleBlock('cardGlow')).toContain('right: 0')
    expect(styleBlock('cardGlow')).not.toContain("right: '-50px'")
  })
})
