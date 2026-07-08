import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/leagues/page.tsx'), 'utf8')

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
})
