import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/teams/page.tsx'), 'utf8')

describe('Teams Hub preview', () => {
  it('makes Team Hub and Captain Tools concrete before directory results', () => {
    expect(source).toContain('TiqActionCard')
    expect(source).toContain('Team next actions')
    expect(source).toContain('Pick the match-week job, then open the right tool.')
    expect(source).toContain('Find a team or roster')
    expect(source).toContain('Collect who can play')
    expect(source).toContain('Build the courts')
    expect(source).toContain('Refresh team context')
    expect(source).toContain('Team Hub preview')
    expect(source).toContain('Availability, lineup, scouting, and match week.')
    expect(source).toContain('TiqWorkspacePreview')
    expect(source).toContain('TiqLineupPreview')
    expect(source).toContain('Opponent scouting')
  })

  it('tracks availability, lineup, and scouting actions from the preview band', () => {
    expect(source).toContain("eventName: 'availability_clicked'")
    expect(source).toContain("eventName: 'lineup_preview_clicked'")
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
})
