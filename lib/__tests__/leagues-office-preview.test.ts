import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/leagues/page.tsx'), 'utf8')

describe('Leagues Office preview', () => {
  it('makes League Office operations concrete before directory data loads', () => {
    expect(source).toContain('TiqActionCard')
    expect(source).toContain('leagueNextActionGrid')
    expect(source).toContain("location: 'league_next_actions'")
    expect(source).toContain('League Office preview')
    expect(source).toContain('Schedules, standings, corrections, and messages.')
    expect(source).toContain('TiqWorkspacePreview')
    expect(source).toContain('TiqLeagueStandingCard')
    expect(source).toContain('Data Assist handoff')
    expect(source).toContain('create a TIQ League Office workspace')
    expect(source).not.toContain('create a TIQ league workspace')
  })

  it('tracks schedule, standings, and Data Assist handoff actions', () => {
    expect(source).toContain("eventName: 'schedule_preview_clicked'")
    expect(source).toContain("eventName: 'standings_preview_clicked'")
    expect(source).toContain("const dataAssistLeagueOfficeHref = '/data-assist?intent=request-review&context=League%20Office'")
    expect(source).toContain('href={dataAssistLeagueOfficeHref}')
    expect(source).toContain("eventName: 'data_assist_opened'")
    expect(source).toContain("location: 'league_office_preview'")
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
