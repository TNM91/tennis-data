import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const teamsSource = readFileSync(join(process.cwd(), 'app/teams/page.tsx'), 'utf8')
const leaguesSource = readFileSync(join(process.cwd(), 'app/leagues/page.tsx'), 'utf8')

describe('Teams and Leagues public intros', () => {
  it('positions Teams publicly while keeping Captain as the paid leadership lane', () => {
    expect(teamsSource).toContain('Team tennis without the group-text chaos.')
    expect(teamsSource).toContain('Find Teams')
    expect(teamsSource).toContain('Open Captain Tools')
    expect(teamsSource).toContain('For players')
    expect(teamsSource).toContain('For captains')
    expect(teamsSource).toContain('For opponents')
    expect(teamsSource).toContain('For leagues')
    expect(teamsSource).toContain('TrackedProductLink')
    expect(teamsSource).toContain("eventName: 'captain_tools_clicked'")
    expect(teamsSource).toContain("eventName: 'team_search_submitted'")
    expect(teamsSource).not.toContain('Captain tennis without')
  })

  it('positions Leagues around League Office operations and Data Assist handoff', () => {
    expect(leaguesSource).toContain('Run the season without the spreadsheet chaos.')
    expect(leaguesSource).toContain('Find Leagues')
    expect(leaguesSource).toContain('Open League Office')
    expect(leaguesSource).toContain('League discovery')
    expect(leaguesSource).toContain('League setup')
    expect(leaguesSource).toContain('Corrections')
    expect(leaguesSource).toContain('Use Data Assist')
    expect(leaguesSource).toContain('TrackedProductLink')
    expect(leaguesSource).toContain("eventName: 'league_search_submitted'")
    expect(leaguesSource).toContain("eventName: 'league_office_clicked'")
  })
})
